 const cf = require('@mapbox/cloudfriend');

 const Parameters = {
    'TMSecret': {
        'Type': 'String',
        'Description': 'Secret encryption string',
        'Default': 'qzbVGee2MGtaxVHEVFxbnxVp'
    },
    'TMConsumerKey': {
        'Type': 'String',
        'Description': 'OSM OAuth Consumer Key for this instance',
        'Default': 'test'
    },
    'TMConsumerSecret': {
        'Type': 'String',
        'Description': 'OSM OAuth Consumer Secret for this instance',
        'Default': 'test'
    },
    'KeypairName': {
        'Type': 'String',
        'Description': 'Name the EC2 keypair to use for this stack. This should be created before on the console.',
        'Default': 'data-team'
    },
    'InstanceType': {
        'Type': 'String',
        'Description': 'EC2 instance type to use',
        'Default': 'm4.xlarge',
        'AllowedValues': [
            'm4.large',
            'm4.xlarge',
            'm4.2xlarge',
            'm4.4xlarge',
            'm4.10xlarge'
        ]
    },
    'MaxInstances': {
        'Type': 'Number',
        'Description': 'Maximum number of instances in this cluster',
        'Default': 1
    },
    'DesiredInstances': {
        'Type': 'Number',
        'Description': 'Desired number of instances in this cluster',
        'Default': 1
    },
    'TMAPIEnvironment': {
        'Type': 'String',
        'Description': 'Environment for TM API. production or staging. The DNS is mapped based on this.',
        'AllowedValues': [
            'Prod',
            'Stage'
        ]
    }
}

const Resources = {
    TMService: {
        Type: 'AWS::ECS::Service',
        Properties: {
            ServiceName: cf.join('-', [cf.stackName, 'Service-TM']),
            Cluster: cf.ref('MLEnablerECSCluster'),
            TaskDefinition: cf.ref('TMTaskDefinition'),
            LaunchType: 'FARGATE',
            HealthCheckGracePeriodSeconds: 300,
            DesiredCount: 1,
            NetworkConfiguration: {
                AwsvpcConfiguration: {
                    AssignPublicIp: 'ENABLED',
                    SecurityGroups: [ cf.ref('MLEnablerServiceSecurityGroup') ],
                    Subnets: [
                        cf.ref('MLEnablerSubA'),
                        cf.ref('MLEnablerSubB')
                    ]
                }
            },
            LoadBalancers: [{
                ContainerName: 'app',
                ContainerPort: 8000,
                TargetGroupArn: cf.ref('TMTargetGroup')
            }]
        }
    },
    TMELB: {
        Type: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
        Properties: {
            Name: cf.stackName,
            Type: 'application',
            SecurityGroups: [ cf.ref('MLEnablerELBSecurityGroup') ],
            Subnets: [
                cf.ref('MLEnablerSubA'),
                cf.ref('MLEnablerSubB')
            ]
        }
    },
    TMTargetGroup: {
        Type: 'AWS::ElasticLoadBalancingV2::TargetGroup',
        Properties: {
            Port: 5000,
            Protocol: 'HTTP',
            VpcId: cf.ref('MLEnablerVPC'),
            TargetType: 'ip',
            Matcher: {
                HttpCode: '200,202,302,304'
            }
        }
    },
    TMHTTPListener: {
        Type: 'AWS::ElasticLoadBalancingV2::Listener',
        Condition: 'HasNoSSL',
        Properties: {
            DefaultActions: [{
                Type: 'forward',
                TargetGroupArn: cf.ref('TMTargetGroup')
            }],
            LoadBalancerArn: cf.ref('MLEnablerELB'),
            Port: 80,
            Protocol: 'HTTP'
        }
    },
    TMTaskDefinition: {
        Type: 'AWS::ECS::TaskDefinition',
        Properties: {
            Family: cf.stackName,
            NetworkMode: 'awsvpc',
            RequiresCompatibilities: ['FARGATE'],
            Tags: [{
                Key: 'Name',
                Value: cf.join('-', [cf.stackName, 'tm'])
            }],
            ContainerDefinitions: [{
                    Name: 'tm',
                    Cpu: 1024,
                    Essential: true,
                    Environment: [{
                        Name: 'TM_DB',
                        Value: cf.join(['postgres://', cf.ref('DatabaseUser'), ':', cf.ref('DatabasePassword'), '@', cf.getAtt('MLEnablerRDS', 'Endpoint.Address'), ':5432/mlenabler'])
                    },{
                        Name: 'TM_SECRET',
                        Value: cf.ref('TMSecret')
                    },{
                        Name: 'TM_CONSUMER_KEY',
                        Value: cf.ref('TMConsumerKey')
                    },{
                        Name: 'TM_CONSUMER_SECRET',
                        Value: cf.ref('TMConsumerSecret')
                    },{
                        Name: 'TM_ENV',
                        Value: cf.ref('TMAPIEnvironment')
                    }],
                    Image: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/ml-enabler:tmapi-', cf.ref('GitSha')]),
                    'PortMappings': [{
                        'ContainerPort': 8000,
                        'HostPort': 8000,
                        'Protocol': 'tcp'
                    }],
                    'MemoryReservation': 2000,
                    'LogConfiguration': {
                        'LogDriver': 'awslogs',
                        'Options': {
                            'awslogs-group': cf.join('-', ['awslogs', cf.stackName]),
                            'awslogs-region': cf.region,
                            'awslogs-stream-prefix': cf.join('-', ['awslogs', cf.stackName]),
                            'awslogs-create-group': true
                        }
                    }
                },{
                    Name: 'tm-client',
                    Command: ['nginx'],
                    Cpu: 1024,
                    Essential: true,
                    Environment: [{
                        Name: 'TM_DB',
                        Value: cf.join(['postgres://', cf.ref('DatabaseUser'), ':', cf.ref('DatabasePassword'), '@', cf.getAtt('MLEnablerRDS', 'Endpoint.Address'), ':5432/mlenabler'])
                    }],
                    Image: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/ml-enabler:tmclient-', cf.ref('GitSha')]),
                    PortMappings: [{
                        ContainerPort: 80,
                        HostPort: 80,
                        Protocol: 'tcp'
                    }],
                    MemoryReservation: 2000,
                    LogConfiguration: {
                        LogDriver: 'awslogs',
                        Options: {
                            'awslogs-group': cf.join('-', ['awslogs', cf.stackName]),
                            'awslogs-region': cf.region,
                            'awslogs-stream-prefix': cf.join('-', ['awslogs', cf.stackName]),
                            'awslogs-create-group': true
                        }
                    },
                    'Links': [ 'tm' ]
                }
            ]
        }
    }
};

module.exports = {
    Parameters,
    Resources
}

const cf = require('@mapbox/cloudfriend');

const Parameters = {

};

const Resources = {
    "AWSBatchServiceRole": {
        "Type": "AWS::IAM::Role",
        "Properties": {
            "AssumeRolePolicyDocument": {
                "Version": "2012-10-17",
                "Statement": [{
                    "Effect": "Allow",
                    "Principal": {
                        "Service": "batch.amazonaws.com"
                    },
                    "Action": "sts:AssumeRole"
                }]
            },
            "ManagedPolicyArns": [ "arn:aws:iam::aws:policy/service-role/AWSBatchServiceRole" ],
            "Path": "/service-role/"
        }
    },
    "BatchInstanceRole": {
        "Type": "AWS::IAM::Role",
        "Properties": {
            "AssumeRolePolicyDocument": {
                "Version": "2012-10-17",
                "Statement": [{
                    "Effect": "Allow",
                    "Principal": {
                        "Service": "ec2.amazonaws.com"
                    },
                    "Action": "sts:AssumeRole"
                }]
            },
            "ManagedPolicyArns": [ "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role" ],
            "Path": "/"
        }
    },
    "BatchInstanceProfile": {
        "Type": "AWS::IAM::InstanceProfile",
        "Properties": {
            "Roles": [ cf.ref('BatchInstanceRole') ],
            "Path": "/"
        }
    },
    "BatchJobRole": {
        "Type": "AWS::IAM::Role",
        "Properties": {
            "AssumeRolePolicyDocument": {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Principal": {
                            "Service": "ecs-tasks.amazonaws.com"
                        },
                        "Action": "sts:AssumeRole"
                    }
                ]
            },
            "Policies": [],
            "Path": "/"
        }
    },
    "BatchComputeEnvironment": {
        "Type" : "AWS::Batch::ComputeEnvironment",
        "Properties" : {
            "Type" : "MANAGED",
            "ServiceRole" : cf.getAtt('AWSBatchServiceRole', 'Arn'),
            "ComputeEnvironmentName" : cf.join('-', ['batch', cf.ref('AWS::StackName')]),
            "ComputeResources" : {
                "ImageId": "ami-056807e883f197989",
                "MaxvCpus" : 128,
                "DesiredvCpus" : 32,
                "MinvCpus" : 0,
                "SecurityGroupIds" : [ cf.ref('SecurityGroup') ],
                "Subnets" :  [
                    cf.ref('MLEnablerPrivateSubA'),
                    cf.ref('MLEnablerPrivateSubB')
                ],
                "Type" : "EC2",
                "InstanceRole" : cf.getAtt('BatchInstanceProfile', 'Arn'),
                "InstanceTypes" : [ "optimal" ]
            },
            "State" : "ENABLED"
        }
    },
    "BatchJobDefinition": {
        "Type": "AWS::Batch::JobDefinition",
        "Properties": {
            "Type": "container",
            "JobDefinitionName": "batch-job",
            "RetryStrategy": {
                "Attempts": 1
            },
            "Parameters": { },
            "ContainerProperties": {
                "Command": [ "./scripts/model.py", ],
                "Memory": 4000,
                "Privileged": true,
                "JobRoleArn": cf.getAtt('BatchJobRole', 'Arn'),
                "ReadonlyRootFilesystem": false,
                "Vcpus": 2,
                Image: cf.join([cf.accountId, '.dkr.ecr.', cf.region, '.amazonaws.com/ml-enabler:', cf.ref('GitSha')])
            }
        }
    },
    "SecurityGroup": {
        "Type": "AWS::EC2::SecurityGroup",
        "Properties": {
            "VpcId": cf.ref('MLEnablerVPC'),
            "GroupDescription": "Batch Security Group",
            SecurityGroupIngress: []
        }
    },
    "BatchJobQueue": {
        "Type": "AWS::Batch::JobQueue",
        "Properties": {
            "ComputeEnvironmentOrder": [{
                "Order": 1,
                "ComputeEnvironment": cf.ref('BatchComputeEnvironment')
            }],
            "State": "ENABLED",
            "Priority": 1,
            "JobQueueName": "HighPriority"
        }
    }
}

module.exports = {
    Parameters,
    Resources
};

<template>
    <div class="col col--12">
        <div class='col col--12 clearfix py6'>
            <h2 class='fl cursor-default'>Add Prediction</h2>

            <button @click='close' class='btn fr round btn--stroke color-gray color-black-on-hover'>
                <svg class='icon'><use href='#icon-close'/></svg>
            </button>
        </div>
        <div class='border border--gray-light round col col--12 px12 py12 clearfix'>
            <div class='grid grid--gut12'>
                <template v-if='!predictionId'>
                    <div class='col col--6 py6'>
                        <label>Prediction Version</label>
                        <input v-model='prediction.version' class='input' placeholder='0.0.0'/>
                    </div>

                    <div class='col col--6 py6'>
                        <label>Prediction Zoom Level</label>
                        <input v-model='prediction.tileZoom' class='input' placeholder='18'/>
                    </div>

                    <div class='col col--12 py12'>
                        <button @click='postPrediction' class='btn btn--stroke round fr color-green-light color-green-on-hover'>Add Prediction</button>
                    </div>
                </template>
                <template v-else>
                    <UploadPrediction :prediction='prediction' v-on:close='close'/>
                </template>
            </div>
        </div>
    </div>

</template>

<script>
import UploadPrediction from './UploadPrediction.vue';

export default {
    name: 'CreatePrediction',
    props: ['modelid'],
    components: {
        UploadPrediction
    },
    mounted: function() {
        this.prediction.modelId = this.modelid;
    },
    data: function() {
        return {
            predictionId: false,
            prediction: {
                modelId: false,
                predictionsId: false,
                version: '',
                tileZoom: '18',
                bbox: [-180.0, -90.0, 180.0, 90.0]
            }
        };
    },
    methods: {
        close: function() {
            this.$emit('close');
        },
        postPrediction: function() {
            fetch(`/v1/model/${this.modelid}/prediction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    modelId: this.prediction.modelId,
                    version: this.prediction.version,
                    tileZoom: this.prediction.tileZoom,
                    bbox: this.prediction.bbox
                })
            }).then((res) => {
                return res.json();
            }).then((res) => {
                this.predictionId = res.prediction_id;
                this.prediction.predictionsId = res.prediction_id;
            }).catch((err) => {
                alert(err);
            });
        }
    }
}
</script>

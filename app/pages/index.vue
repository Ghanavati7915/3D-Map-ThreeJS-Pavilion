<script setup lang="ts">

//#region Instance
import useAPI from "~/composables/useAPI";

const api = new useAPI()
//#endregion

//#region Variables
const exhibit = ref<any>({
  // id:"692c86627e6cb0fcd5bb6d5a",
  id:"6921b4835d3253b195973ab7",
  title:'',
  cover:'',
  workFields:[],
  companies:[]
})
const viewMode = ref<boolean>(true)
const loading = ref<boolean>(false)
const mapData = ref<any>(null);
//#endregion

//#region Functions
const getCompanies = async () => {
  try {
  const {result, data} = await api.getCompanies(exhibit.value.id)
  if (result && Array.isArray(data)) exhibit.value.companies.push(...data)
  } catch (e) {
    console.log('Error On getCompanies : ', e)
    loading.value = false;
  }
}
const getExhibit = async () => {
  try {
    const {result, data} = await api.getExhibit(exhibit.value.id)
    if (result && data){
      exhibit.value.title = data.title;
      exhibit.value.cover = data.poster;
      exhibit.value.workFields = data.workFields;
    }
  } catch (e) {
    console.log('Error On getCompanies : ', e)
    loading.value = false;
  }
}
const loadData = async () => {
  try {
    const response = await api.getMap(exhibit.value.id)
    if (response.result) {
      const jsonUrl = response.data.mapSVG // لینک JSON File
      try {
        const data = await $fetch(jsonUrl)
        mapData.value = data
      } catch (err) {
        console.error('خطا در بارگذاری JSON:', err)
      }
    }
  } catch (e) {
    console.log('Error On loadData : ', e)
    loading.value = false;
  }
}
const onExport = async (data:any) =>{
  try{
    loading.value = true;
    let polygonAssigns:any[] = [];
    data.forEach((it:any)=>{
      if (it.hostID){
        polygonAssigns.push({
          id : it.locationID,
          data : it.boothCode
        });
      }
    })

    const jsonStr = JSON.stringify(data)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const formData = new FormData()
    formData.append('file', blob, `map_${exhibit.value.id}.json`)
    formData.append('folderName', 'ExhibitMap');

    const responseUpload = await api.upload(formData)
    if (responseUpload.result){
      let filePath = responseUpload.data.urls[0];
      const response = await api.saveMap(exhibit.value.id,filePath,polygonAssigns)
      if (response.result){
        alert('Save Success')
        loading.value = false;
      }
      else{
        alert('Error On Save')
        loading.value = false;
      }
    }else{
      alert('Error Upload')
      loading.value = false;
    }
  }catch (e) {
    console.log('Error On Export : ' , e)
    loading.value = false;
  }

}
const onSelect = (data:any)=>{
  console.log('*** onSelect : ' ,data)
}
//#endregion

//#region Life Cycle
onMounted(async () => {
  loading.value = true;
  await getExhibit();
  await getCompanies();
  setTimeout(()=>{
    loadData();
    loading.value = false;
  },2000)

})
//#endregion
</script>

<template>
  <div class="w-[100dvw] h-[100dvh] relative">
    <CapMapView
        v-if="viewMode"
        :mapData="mapData"
        :loading="loading"
        :companies="exhibit.companies"
        :title="exhibit.title"
        :cover="exhibit.cover"
        :workFields="exhibit.workFields"
        @select="onSelect"
    />
    <CapMapEdit
        v-if="!viewMode"
        :mapData="mapData"
        :loading="loading"
        :companies="exhibit.companies"
        :title="exhibit.title"
        @export="onExport"
        @select="onSelect"
    />
  </div>
</template>

<style scoped>

</style>
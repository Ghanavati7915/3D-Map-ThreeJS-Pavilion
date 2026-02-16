<script setup lang="ts">
//#region PROPS
const props = defineProps({
  title : {type:String ,default: ""},
  cover : {type:String ,default: ""},
  mapData : {default: null},
  companies : {type: Array,default: []},
  workFields : {type: Array,default: []},
});
//#endregion

//#region Emit
const emit = defineEmits(['select'])
//#endregion

//#region Variables
const space = ref<any>(null)
const toolbox = ref<any>(null)
const routingMode = ref(false)
const polygons = ref<any[]>([])
//#endregion

//#region Functions
function toggleRouting() {
  routingMode.value = !routingMode.value
  routingMode.value
      ? space.value.startRouting()
      : space.value.cancelRouting()
}
function endRouting() {
  routingMode.value = false;
}
const onClickPolygon = (data: any) => {
  toolbox.value.onExternalSelect(data);
  if (data.length>0) emit('select',data);
}
const onUpdate = (data:any) => {
  polygons.value = data;
  toolbox.value.onPolygon(data);
}
const onSelectCompany = (data: any) => {
  space.value.selectBoothsById(data);
}
//#endregion

//#region Watch
watch(() => props.mapData, () => {
  if (props.mapData) space.value.importScene(props.mapData)
}, { deep: true })
watch(() => props.cover, () => {
  if (props.cover != '') space.value.addImageToScene(props.cover,50, 24,-2, 55)
}, { deep: true })
//#endregion
</script>

<template>
  <div class="w-full h-full relative">
    <CapMapSpace
        ref="space"
        :editMode="false"
        :title="props.title"
        :routing="routingMode"
        @update="onUpdate"
        @end-routing="endRouting"
        @selectBooth="onClickPolygon"
    />
    <CapMapToolboxUser
        ref="toolbox"
        :companies="companies"
        :routingMode="routingMode"
        :title="title"
        :workFields="workFields"
        @select="onSelectCompany"
        @toggle-routing="toggleRouting"
    />
  </div>
</template>

<style scoped>

</style>
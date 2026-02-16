<script setup lang="ts">

//#region PROPS
const props = defineProps({
  title : {type:String ,default: ""},
  mapData : {default: null},
  loading : {type: Boolean,default: false},
  companies : {type: Array,default: []},
});
const emit = defineEmits(['export','save','select'])
//#endregion

//#region Variables
const editor = ref<any>(null)
const toolbox = ref<any>(null)
const polygons = ref<any[]>([])
const exportedMapData = ref<any>(null)
const drawModeExhibit = ref(false)
const drawModeWalkable = ref(false)
//#endregion

//#region Watch
watch(() => props.mapData, () => {
  if (props.mapData) editor.value.importScene(props.mapData)
}, { deep: true })
//#endregion

//#region Functions
const startDrawExhibit = ()=>{
  drawModeExhibit.value = true
  editor.value.startPolygon('booth')
}
const startDrawWalkable = ()=>{
  drawModeWalkable.value = true
  editor.value.startPolygon('walkable')
}
const endDrawExhibit = (callEditor:boolean=false,callToolbox:boolean=false)=>{
  drawModeExhibit.value = false
  if (callToolbox){
    toolbox.value.finishDrawExhibit(false);
  }
  if (callEditor){
    editor.value.finishPolygon();
  }
}
const endDrawWalkable = (callEditor:boolean=false,callToolbox:boolean=false)=>{
  drawModeWalkable.value = false
  if (callToolbox){
    toolbox.value.finishDrawWalkable(false);
  }
  if (callEditor){
    editor.value.finishPolygon();
  }
}
const onUpdate = (data:any) => {
  endDrawExhibit(false,true);
  endDrawWalkable(false,true);
  polygons.value = data;
  toolbox.value.onPolygon(data);
}
const onExport = (data:any) => {
  exportedMapData.value = data;
  //emit('export',data)
}
const onSave = () => {
  emit('export',exportedMapData.value)
  emit('save')
}
const onDelete = (id: number) => {
  editor.value.removePolygon(id)
}
const onEdit = (data: number) => {
  editor.value.updatePolygon(data)
}
const onSelect = (data: number) => {
  editor.value.selectBoothsById([data?.id])
}
const onClickPolygon = (data: any) => {
  toolbox.value.onExternalSelect(data);
  if (data.length>0) emit('select',data);
}
const requestJSON = () => {
  editor.value.exportScene()
}
const loadJSON = (data:any) => {
  editor.value.importScene(data)
}
//#endregion

</script>

<template>
  <div class="w-full h-full relative">
    <CapMapSpace
        ref="editor"
        :editMode="true"
        @update="onUpdate"
        @export="onExport"
        @selectBooth="onClickPolygon"
    />
    <CapMapToolboxEditor
        ref="toolbox"
        :title="title"
        :loading="loading"
        :companies="companies"
        @startDrawExhibit="startDrawExhibit"
        @startDrawWalkable="startDrawWalkable"
        @endDrawExhibit="endDrawExhibit"
        @endDrawWalkable="endDrawWalkable"
        @selectPolygon="onSelect"
        @updatePolygon="onEdit"
        @deletePolygon="onDelete"
        @createJSON="requestJSON"
        @importJSON="loadJSON"
        @save="onSave"
    />
  </div>
</template>

<style scoped>

</style>
<script setup lang="ts">

//#region PROPS - Emit
const emit = defineEmits([
  'start-draw-exhibit',
  'start-draw-walkable',
  'end-draw-exhibit',
  'end-draw-walkable',
  'select-polygon',
  'update-polygon',
  'delete-polygon',
  'create-JSON',
  'import-JSON',
  'save',
])
const props = defineProps({
  title : {type: String,default:""},
  loading : {type: Boolean,default:false},
  polygons : {type: Array,default: []},
  companies : {type: Array,default: []},
});
//#endregion

//#region Instance
const router = useRouter()
//#endregion

//#region Variables
const _polygons = ref<any[]>([]);
const _walkable = ref<any[]>([]);
const drawExhibitMode = ref<boolean>(false);
const drawWalkableMode = ref<boolean>(false);
const isOpenPolygons = ref<boolean>(false)
const isOpenWalkables = ref<boolean>(false)
const selectedPolygon = ref<any>(null)
const companySearch = ref<any>(null)
const polygonSearch = ref<any>(null)
//#endregion

//#region Functions
const closePolygonDetail = () =>{
  selectedPolygon.value = null
}
const closePolygons = () =>{
  isOpenPolygons.value = false
  selectedPolygon.value = null
}
const openPolygons = () => {
  if (props.loading) return;
  closeWalkables()
  isOpenPolygons.value = true
}
const closeWalkables = () =>{
  isOpenWalkables.value = false
}
const openWalkables = () => {
  if (props.loading) return;
  closePolygons()
  isOpenWalkables.value = true
}
const toggleDrawExhibit = () =>{
  if (props.loading) return;
  if (drawExhibitMode.value) finishDrawExhibit();
  else startDrawExhibit();
}
const toggleDrawWalkable = () =>{
  if (props.loading) return;
  if (drawWalkableMode.value) finishDrawWalkable();
  else startDrawWalkable();
}
const startDrawExhibit = () => {
  if (drawWalkableMode.value) drawWalkableMode.value = false
  if (isOpenPolygons.value) isOpenPolygons.value = false
  drawExhibitMode.value = true;
 setTimeout(()=>{
   emit('start-draw-exhibit')
 },500)
}
const finishDrawExhibit = (callEditor:boolean=true) => {
  if (!callEditor) drawExhibitMode.value = false;
  if (callEditor) emit('end-draw-exhibit',true,false)
}
const startDrawWalkable = () => {
  if (drawExhibitMode.value) drawExhibitMode.value = false
  if (isOpenPolygons.value) isOpenPolygons.value = false
  drawWalkableMode.value = true;
  setTimeout(()=>{
    emit('start-draw-walkable')
  },500)
}
const finishDrawWalkable = (callEditor:boolean=true) => {
  if (!callEditor) drawWalkableMode.value = false;
  if (callEditor) emit('end-draw-walkable',true,false)
}
const onPolygon = (data:any) =>{
  _polygons.value = data.filter((it:any)=>it.type == 'booth');
  _walkable.value = data.filter((it:any)=>it.type == 'walkable');
}
const walkableDelete = (id:any) => {
  if (props.loading) return;
  emit('delete-polygon',id);
}
const polygonDelete = () => {
  if (selectedPolygon.value){
    let x = _polygons.value.find((it:any)=> selectedPolygon.value.id == it.id)
    if (x){
      emit('delete-polygon',x.id);
    }
  }
}
const polygonSelect = (data:any) => {
  if (selectedPolygon.value == data) {
    selectedPolygon.value = null;
    emit('select-polygon',null);
  }
  else {
    selectedPolygon.value = data;
    emit('select-polygon',data);
  }
}
const polygonAssign = (data:any) => {
  let polygon = _polygons.value.find((it:any)=> it.id == selectedPolygon.value.id)
  if (polygon){
    polygon.hostID = data.id
    polygon.locationID = data.locationID
    polygon.title = data.title
    polygon.data = data
  }
  emit('update-polygon',polygon);
}
const polygonUpdate = () => {
  if (selectedPolygon.value){
    let x = _polygons.value.find((it:any)=> selectedPolygon.value.id == it.id)
    if (x){
      emit('update-polygon',x);
    }
  }
}
const normalizePersian = (text = '') => {
  let s = text.normalize('NFKD').replace(/\p{M}/gu, '');

  // حروف عربی/فارسی
  s = s
      .replace(/ي/g, 'ی')
      .replace(/ى/g, 'ی')
      .replace(/ئ/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/ة/g, 'ه')
      .replace(/ۀ/g, 'ه')
      .replace(/ؤ/g, 'و')
      .replace(/أ|إ|ٱ/g, 'ا');

  // اعداد فارسی (۰۱۲۳۴۵۶۷۸۹) → لاتین
  s = s.replace(/[۰-۹]/g, d => String.fromCharCode(d.charCodeAt(0) - 1728));

  // اعداد عربی/هندی (٠١٢٣٤٥٦٧٨٩) → لاتین
  s = s.replace(/[٠-٩]/g, d => String.fromCharCode(d.charCodeAt(0) - 1584));

  // حذف کشیدگی و نویسه‌های نامرئی
  s = s
      .replace(/\u0640/g, '')     // ـ
      .replace(/\u200C/g, ' ')    // نیم‌فاصله → فاصله
      .replace(/[\u200E\u200F]/g, '') // LRM/RLM
      .replace(/\s+/g, ' ')
      .trim();

  return s.normalize('NFC').toLowerCase();
}
const finish = () => {
  if (props.loading) return;
  if (drawExhibitMode.value) drawExhibitMode.value = false
  if (drawWalkableMode.value) drawWalkableMode.value = false
  if (isOpenPolygons.value) isOpenPolygons.value = false
  emit('create-JSON');
  setTimeout(()=>{
    emit('save');
  },700)
}
const back = () => {
  router.back()
}
const onExternalSelect = (data:any) => {
  if (data.length > 0){
    if (!isOpenPolygons.value) isOpenPolygons.value = true;
    selectedPolygon.value = Polygons.value.find((it: any) => data[0].id == it.id);
  }else{
    selectedPolygon.value = null;
  }
}
//#endregion

//#region Computed
const Companies = computed(() => {
  const query = normalizePersian(companySearch.value || '');
  if (!query) {
    return  props.companies;
  }
  return props.companies.filter((it: any) => {
    const title = normalizePersian(it.title || '');
    return title.includes(query) || it.id == selectedPolygon.value.data?.id;
  });
});
const Polygons = computed(() => {
  const query = normalizePersian(polygonSearch.value || '');
  if (!query) {
    return  _polygons.value;
  }

  return _polygons.value.filter((it: any) => {
    const title = normalizePersian(it.title || '');
    const boothCode = normalizePersian(it.boothCode || '');
    return title.includes(query) || boothCode.includes(query);
  });
});
//#endregion

//#region export
defineExpose({finishDrawExhibit,finishDrawWalkable,onPolygon,onExternalSelect})
//#endregion

</script>

<template>
  <div>
    <!--#region Walkables-->
    <div :class="isOpenWalkables ? '' : 'translate-x-64'" class="w-64 h-[100dvh] fixed overflow-hidden shadow-lg right-0 top-0 gap-y-4 z-50 flex flex-col justify-start items-center bg-white transition-all ease-in-out duration-300 py-3 px-2">
      <!--#region Header - Search -->
      <div class="flex w-full justify-between items-center gap-x-2">
        <span class="Estedad_FD_Bold"> مسیر های قابل تردد </span>
        <!--#region Close-->
        <div class="bg-gray-100 rounded-lg p-1 w-10 flex justify-center items-center cursor-pointer hover:bg-gray-200" @click="closeWalkables">
          <Icon class="text-slate-800" :class="loading ? 'animate-spin' : '!text-slate-800'" :name="loading ? 'ph:circle-notch' : 'ph:caret-right'" size="20"/>
        </div>
        <!--#endregion-->
      </div>
      <!--#endregion-->
      <!--#region Items-->
      <div class="flex flex-1 w-full overflow-hidden">
        <div class="w-full flex flex-col flex-1 overflow-auto pe-1 scrollbar justify-start items-center">
          <div v-for="(it,i) in _walkable" :key="`walkable_${it.id}`" class="w-full flex">
            <div
                :class="[i != 0 ? 'border-t border-gray-200' : '']"
                class=" cursor-pointer w-full py-3 px-2 text-gray-900 flex justify-between items-center">
              <span class="line-clamp-1 Estedad_FD_Light"> {{it.title}} </span>
              <div class="bg-gray-100 rounded-lg p-1 w-10 flex justify-center items-center cursor-pointer hover:bg-gray-200" @click="walkableDelete(it.id)">
                <Icon class="text-slate-800" :class="loading ? 'animate-spin' : '!text-rose-500'" :name="loading ? 'ph:circle-notch' : 'ph:trash-duotone'" size="20"/>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!--#endregion-->
    </div>
    <!--#endregion-->

    <!--#region Polygons-->
    <div :class="isOpenPolygons ? '' : 'translate-x-64'" class="w-64 h-[100dvh] fixed overflow-hidden shadow-lg right-0 top-0 gap-y-4 z-50 flex flex-col justify-start items-center bg-white transition-all ease-in-out duration-300 py-3 px-2">
      <!--#region Header - Search -->
      <div class="flex w-full justify-between items-center gap-x-2">
        <!--#region Search-->
        <input v-model="polygonSearch" type="text" class="bg-gray-100 Estedad_FD_Light rounded-lg w-full text-right text-xs p-2 text-gray-900" placeholder="جستجو"/>
        <!--#endregion-->
        <!--#region Close-->
        <div class="bg-gray-100 rounded-lg p-1 w-10 flex justify-center items-center cursor-pointer hover:bg-gray-200" @click="closePolygons">
          <Icon class="text-slate-800" :class="loading ? 'animate-spin' : '!text-slate-800'" :name="loading ? 'ph:circle-notch' : 'ph:caret-right'" size="20"/>
        </div>
        <!--#endregion-->
      </div>
      <!--#endregion-->
      <!--#region Items-->
      <div class="flex flex-1 w-full overflow-hidden">
        <div class="w-full flex flex-col flex-1 overflow-auto pe-1 scrollbar justify-start items-center">
          <div v-for="(it,i) in Polygons" :key="`exhibitor_${it.id}`" class="w-full flex">
            <div
                :class="[
                  i != 0 ? 'border-t border-gray-200' : '',
                  selectedPolygon == it ? 'bg-rose-500/20 bg-blur border border-rose-500  rounded-lg' : 'text-gray-900'
                  ]"
                class=" cursor-pointer w-full py-2 px-2 flex flex-col justify-start items-start"
                @click="polygonSelect(it)"
            >
              <div class="flex gap-y-1 text-sm justify-center items-center Estedad_FD_Light">
                <div :style="`background:${it.color}`" class="rounded-full size-3"></div>
                <span class="mr-2 line-clamp-1"> {{it.title}} </span>
              </div>
              <span class="text-gray-600 text-xs h-[1lh] line-clamp-1 mt-1 Estedad_FD_Light pr-5">{{it.boothCode}}</span>
            </div>
          </div>
        </div>
      </div>
      <!--#endregion-->
    </div>
    <!--#endregion-->

    <!--#region Detail-->
    <div :class="isOpenPolygons && selectedPolygon ? '' : '-translate-x-64'" class="w-64 h-[100dvh] fixed overflow-hidden shadow-lg left-0 top-0 gap-y-4 z-50 flex flex-col justify-start items-center bg-white transition-all ease-in-out duration-300 py-3 px-2">

      <!--#region Header-->
      <div class="flex w-full justify-start items-center">
        <span class="Estedad_FD_Bold text-sm line-clamp-1"> {{selectedPolygon?.title}} </span>
      </div>
      <!--#endregion-->

      <!--#region Code-->
      <div v-if="selectedPolygon" class="flex flex-col Estedad_FD_Light text-gray-600 text-xs w-full justify-center items-start gap-y-1">
        <span class="mb-2"> شناسه غرفه </span>
        <input type="text" v-model="selectedPolygon.boothCode" @input="polygonUpdate()"  class="bg-gray-100 Estedad_FD_Light rounded-lg w-full text-center text-xs p-2 text-gray-900"/>
      </div>
      <!--#endregion-->

      <!--#region Companies-->
      <div v-if="selectedPolygon" class="flex flex-col flex-1 overflow-hidden Estedad_FD_Light text-gray-600 text-xs w-full justify-center items-start gap-y-1">
        <span class="mb-2"> شرکت کنندگان </span>
        <!--#region Search-->
        <div class="flex flex-col Estedad_FD_Light text-gray-600 text-xs w-full justify-center items-start gap-y-1">
          <input v-model="companySearch" type="text" placeholder="جستجو ( عنوان شرکت )" class="bg-gray-100 Estedad_FD_Light rounded-lg w-full text-center text-xs p-2 text-gray-900"/>
        </div>
        <!--#endregion-->
        <div class="flex flex-1 w-full overflow-hidden">
          <div class="w-full flex flex-col flex-1 overflow-auto pe-1 ps-1 scrollbar justify-start items-start">
            <div
                v-for="(it,i) in Companies"
                :key="`company_${it.id}`"
                :class="[
                i != 0 ? 'border-t border-gray-200' : '',
                selectedPolygon?.data?.id == it.id ? 'bg-rose-500/20 bg-blur border border-rose-500 rounded-lg' : ''
                ]"
                class="w-full py-4 px-3 cursor-pointer"
                @click="polygonAssign(it)">
              <span class="line-clamp-1">{{it.title}}</span>
            </div>
          </div>
        </div>
      </div>
      <!--#endregion-->

      <!--#region Colors-->
      <div v-if="selectedPolygon" class="flex flex-col Estedad_FD_Light text-gray-600 text-xs w-full justify-center items-start gap-y-1">
<!--        <span class="mb-2"> رنگ </span>-->
        <div class="w-full flex justify-around items-center gap-x-2">
          <div class="rounded-md bg-[#f44336] size-7 cursor-pointer" @click="()=>{selectedPolygon.color = '#f44336';polygonUpdate()}"></div>
          <div class="rounded-md bg-[#4caf50] size-7 cursor-pointer" @click="()=>{selectedPolygon.color = '#4caf50';polygonUpdate()}"></div>
          <div class="rounded-md bg-[#2196f3] size-7 cursor-pointer" @click="()=>{selectedPolygon.color = '#2196f3';polygonUpdate()}"></div>
          <div class="rounded-md bg-[#ffc107] size-7 cursor-pointer" @click="()=>{selectedPolygon.color = '#ffc107';polygonUpdate()}"></div>
          <div class="rounded-md bg-[#673ab7] size-7 cursor-pointer" @click="()=>{selectedPolygon.color = '#673ab7';polygonUpdate()}"></div>
          <div class="rounded-md bg-[#009688] size-7 cursor-pointer" @click="()=>{selectedPolygon.color = '#009688';polygonUpdate()}"></div>
        </div>
      </div>
      <!--#endregion-->

      <!--#region Tool-->
      <div class="flex w-full justify-between gap-x-2 items-center">
          <div class="bg-gray-100 rounded-lg p-1 w-10 flex justify-center items-center cursor-pointer hover:bg-gray-200" @click="closePolygonDetail">
            <Icon class="text-slate-800" :class="loading ? 'animate-spin' : '!text-slate-700'" :name="loading ? 'ph:circle-notch' : 'ph:caret-left'" size="20"/>
          </div>
          <div class="bg-gray-100 rounded-lg p-1 w-10 flex justify-center items-center cursor-pointer hover:bg-gray-200" @click="polygonDelete">
            <Icon class="text-slate-800" :class="loading ? 'animate-spin' : '!text-rose-500'" :name="loading ? 'ph:circle-notch' : 'ph:trash-duotone'" size="20"/>
          </div>
      </div>
      <!--#endregion-->
    </div>
    <!--#endregion-->

    <!--#region Header-->
    <div class="w-full fixed top-3 left-0 flex justify-between items-center px-10">
      <!--#region Right:Title-->
      <div class="flex flex-col justify-center items-center">
        <div v-if="!loading" class="flex flex-col text-xs Estedad_FD_Bold text-center w-full text-gray-700">{{props.title}}</div>
        <div v-if="loading" class="flex flex-col">
          <span class="text-xs Estedad_FD_Light mb-2 text-center w-full text-gray-700"> در حال دریافت / ذخیره اطلاعات ... </span>
        </div>
      </div>
      <!--#endregion-->
      <!--#region Left:Save-->
      <div class=" h-13 bg-white shadow-lg rounded-lg flex justify-center items-center px-2 gap-x-2">
        <div class="bg-gray-200 text-white rounded-lg p-2 size-10 flex justify-center items-center  cursor-pointer hover:bg-gray-200" @click="back">
          <Icon name="ph:caret-left" class="text-slate-800" size="20"/>
        </div>
      </div>
      <!--#endregion-->
    </div>
    <!--#endregion-->

    <!--#region Footer-->
    <div class="w-full fixed bottom-3 left-0 flex justify-between items-end px-10">
      <!--#region Right:Polygons-->
      <div :class="_polygons.length == 0 && _walkable.length == 0 ? 'opacity-0' : ''" class="h-13 bg-white shadow-lg rounded-lg flex justify-center items-center px-2 gap-x-2">
        <div
            v-if="_polygons.length"
            class="bg-gray-200 rounded-lg p-2 size-10 flex justify-center items-center cursor-pointer hover:bg-gray-200"
            :class="isOpenPolygons ? '!bg-red-500' : ''"
            @click="openPolygons"> <Icon class="text-slate-800" :class="loading ? 'animate-spin' : '!text-[#ef7c2c]'" :name="loading ? 'ph:circle-notch' : 'ph:polygon-duotone'" size="20"/> </div>
        <div
            v-if="_walkable.length"
            class="bg-gray-200 rounded-lg p-2 size-10 flex justify-center items-center cursor-pointer hover:bg-gray-200"
            :class="isOpenWalkables ? '!bg-red-500' : ''"
            @click="openWalkables">  <Icon class="text-slate-800" :class="loading ? 'animate-spin' : '!text-[#78b990]'" :name="loading ? 'ph:circle-notch' : 'ph:polygon-duotone'" size="20"/> </div>
      </div>
      <!--#endregion-->
      <!--#region Center:Draw-->
      <div class="flex flex-col justify-center items-center">
        <!--#region Hint-->
        <div v-if="!loading" class="flex flex-col">
          <span v-if="!drawExhibitMode && !drawWalkableMode" class="text-xs Estedad_FD_Light mb-2 text-center w-full text-gray-700"> برای رسم محدوده غرفه یا محیط قابل تردد از گزینه های زیر استفاده کنید </span>
          <span v-if="drawExhibitMode || drawWalkableMode"  class="text-xs Estedad_FD_Light mb-2 text-center w-full text-gray-700">برای ثبت محدوده از کلید Enter استفاده کنید و یا نقطه آخر را به ابتدا متصل کنید ( حداقل 3 نقطه مشخص کنید ) </span>
          <span v-if="drawExhibitMode || drawWalkableMode"  class="text-xs Estedad_FD_Light mb-2 text-center w-full text-gray-700">برای لغو و حذف محدوده رسم شده از کلید ESC استفاده کنید</span>
        </div>
        <div v-if="loading" class="flex flex-col">
          <span class="text-xs Estedad_FD_Light mb-2 text-center w-full text-gray-700"> در حال دریافت / ذخیره اطلاعات ... </span>
        </div>
        <!--#endregion-->
        <!--#region ToolBox-->
        <div class="h-13 bg-white shadow-lg rounded-lg flex justify-center items-center px-2 gap-x-2">
          <div
              v-if="false"
              :class="drawWalkableMode ? '!bg-red-500' : ''"
              @click="toggleDrawWalkable"
              class="bg-gray-200 rounded-lg p-2 size-10 flex justify-center items-center cursor-pointer hover:bg-gray-200">
            <Icon class="text-slate-800" :class="loading ? 'animate-spin' : '!text-slate-800'" :name="loading ? 'ph:circle-notch' : 'ph:person-simple-walk-duotone'" size="20"/>
          </div>
          <div
              :class="drawExhibitMode ? '!bg-red-500' : ''"
              @click="toggleDrawExhibit"
              class="bg-gray-200 rounded-lg p-2 w-10 h-10 flex justify-center items-center cursor-pointer hover:bg-gray-200"
          > <Icon class="text-slate-800" :class="loading ? 'animate-spin' : '!text-slate-800'" :name="loading ? 'ph:circle-notch' : 'ph:pencil-duotone'" size="20"/> </div>
        </div>
        <!--#endregion-->
      </div>
      <!--#endregion-->
      <!--#region Left:Save-->
      <div class=" h-13 bg-white shadow-lg rounded-lg flex justify-center items-center px-2 gap-x-2">
        <div class="bg-gray-200 text-white rounded-lg p-2 size-10 flex justify-center items-center cursor-pointer hover:bg-gray-200" @click="finish">
          <Icon :class="loading ? 'text-slate-800 animate-spin' : 'text-green-500'" :name="loading ? 'ph:circle-notch' : 'ph:floppy-disk-back-duotone'" size="20"/>
        </div>
      </div>
      <!--#endregion-->
    </div>
    <!--#endregion-->
  </div>
</template>

<style scoped>

.scrollbar::-webkit-scrollbar-track
{
  box-shadow: none !important;
  border-radius: 10px;
  background-color: transparent;
}

.scrollbar::-webkit-scrollbar
{
  width: 3px;
  background-color: transparent;
}

.scrollbar::-webkit-scrollbar-thumb
{
  border-radius: 50px;
  -webkit-box-shadow: inset 0 0 6px rgb(195, 193, 193);
  background-color: #0f172b;
}
</style>
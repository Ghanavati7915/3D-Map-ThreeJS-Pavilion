<script setup lang="ts">
//#region Instance
const device = useDevice()
const router = useRouter()
//#endregion

//#region PROPS - Emit
const emit = defineEmits(['toggle-routing','select'])
const props = defineProps({
  title : {type:String ,default: ""},
  polygons : {type: Array,default: []},
  companies : {type: Array,default: []},
  workFields : {type: Array,default: []},
  routingMode : {type: Boolean,default: false},
});
//#endregion

//#region Variables
const isOpenCategories = ref<boolean>(false)
const search = ref<any>(null)
const category = ref<any>(null)
const _polygons = ref<any[]>([]);
const selectedPolygon = ref<any>(null)
//#endregiong

//#region Functions
const openCategories = () => {
  clearSelect()
  isOpenCategories.value = true
}
const closeCategories = () => {
  isOpenCategories.value = false
}
const toggleRouting = () => {
  setTimeout(()=>{
    emit('toggle-routing');
  },500)
}
const onPolygon = (data:any) =>{
  _polygons.value = data.filter((it:any)=>it.type == 'booth');
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
const onExternalSelect = (data:any) => {
  if (data.length > 0){
    let polygon = _polygons.value.find((it: any) => data[0].id == it.id);
    let company = props.companies.find((it: any) => data[0].hostID == it.id);
    if (company){
      selectedPolygon.value = {company,polygon}
    }else{
      selectedPolygon.value = null;
    }
  }else{
    selectedPolygon.value = null;
  }
}
const clearSelect = ()=>{
  if (selectedPolygon.value){
    emit('select', [])
    selectedPolygon.value = null;
    category.value = null;
  }
}
const clearSearch = () => {
  search.value = '';
}
const selectCompany = (data:any)=>{
  search.value = '';
  category.value = null;
  emit('select', [data.id])
  closeCategories()
}
const selectCategory = (data:any)=>{
  search.value = '';
  selectedPolygon.value = null;
  category.value = data.title
  closeCategories()
}
const back = () => {
  router.back()
}
//#endregion

//#region Computed
const SearchResult = computed(() => {
  const query = normalizePersian(search.value || '');
  if (query == '' && category.value == null) return  null;

  if (query != '' && category.value == null){
    clearSelect();
    let res = props.companies.filter((it: any) => {
      const title = normalizePersian(it.title || '');
      const code = normalizePersian(it.code || '');
      // const checkWorkFields = it.workFields.some(x => x.includes(query));
      // return title.includes(query) || code.includes(query) || checkWorkFields;
      return title.includes(query) || code.includes(query) ;
    });
    return res.length > 0 ? res : null
  }
  if (query == '' && category.value != null){
    closeCategories()
    let res = props.companies.filter((it: any) => {
      const checkWorkFields = it.workFields.some(x => x.includes(category.value));
      return checkWorkFields;
    });
    emit('select', res.map((z:any)=>z.id))
    return res.length > 0 ? res : null
  }
});
//#endregion

//#region watch
watch(() => search.value, (data) => {
  if (data) category.value = null;
}, { deep: true })
//#endregion

//#region export
defineExpose({onPolygon,onExternalSelect})
//#endregion
</script>

<template>
  <div class="Estedad_FD_Light">
    <!--#region Filters : Desktop-->
    <div v-if="!device.isMobile" class="flex flex-col top-3 right-3 gap-y-3 fixed w-[35dvw]">
      <!--#region Search-->
      <div class="rounded-lg border border-gray-200 bg-white flex justify-center items-center w-12 h-12 fixed top-5 left-5 transition all ease-in-out cursor-pointer" @click="back">
        <Icon name="ph:caret-left" class="text-slate-800" size="20"/>
      </div>
      <!--#endregion-->
      <!--#region Map Title-->
      <div class="flex w-full justify-center items-center"> <span class="Estedad_FD_Bold text-sm line-clamp-2">{{props.title}}</span> </div>
      <!--#endregion-->
      <!--#region Search-->
      <div class="relative">
        <input v-if="!isOpenCategories" type="text" v-model="search" placeholder="جستجو ..." class="bg-white px-4 py-2 z-10 border border-gray-300 rounded-xl text-lg w-full">
        <div v-if="search" class="absolute top-2 left-2 rounded-lg border border-gray-200 bg-white flex justify-center items-center w-8 h-8 transition all ease-in-out cursor-pointer opacity-50 hover:opacity-100 " @click="clearSearch">
          <Icon class="text-slate-800'" name="ph:x" size="18"/>
        </div>
      </div>
      <!--#endregion-->
      <!--#region Search Result-->
      <div v-if="SearchResult" class="flex flex-col rounded-b-lg -translate-y-5 shadow-lg max-h-[40dvh] overflow-auto bg-linear-to-b from-white to-gray-50 border border-gray-300 gap-y-4 p-5">
       <div v-for="(it,i) in SearchResult"
            :key="`search_${i}`"
            class="cursor-pointer transition-all ease-in-out hover:pr-3"
            @click="selectCompany(it)">
         <span class="text-sm">{{it.title}}</span>
         <div class="flex gap-x-2 mt-1">
           <span v-for="(wk,j) in it.workFields"
                 :key="`search_workfields_${j}`"
                 class="rounded-lg px-2 py-1 border border-gray-300 bg-gray-200 text-xs">
             {{wk}}
           </span>
         </div>
       </div>
      </div>
      <!--#endregion-->
      <!--#region Categories-->
      <div v-if="!SearchResult && !selectedPolygon && !isOpenCategories" class="flex justify-between items-center gap-x-2">
        <span class="bg-white border border-gray-300 flex justify-center items-center px-2 py-2 text-sm rounded-xl cursor-pointer" @click="openCategories"> دسته بندی ها </span>
        <div class="flex gap-x-2 justify-center items-center">
          <span v-if="routingMode" class="text-xs Estedad_FD_Light px-3 py-1 animate-pulse bg-indigo-800 text-white rounded-lg"> مبدا و سپس مقصد را مشخص کنید </span>
          <div
              :class="routingMode ? 'bg-rose-500 border-rose-700' : 'bg-blue-500 border-blue-700'"
              class="shadow-lg text-white rounded-xl p-1 px-4 border flex justify-center items-center cursor-pointer hover:bg-purple-600" @click="toggleRouting">
            {{ routingMode ? 'پایان' : 'مسیریابی' }}
          </div>
        </div>
      </div>
      <!--#endregion-->
      <!--#region Category Result-->
      <div v-if="isOpenCategories" class="flex flex-col rounded-lg relative shadow-lg max-h-[75dvh] bg-linear-to-b from-white to-gray-50 border border-gray-300 py-5 gap-y-2">
        <div class="absolute top-5 -left-4 rounded-lg border border-gray-300 bg-white flex justify-center items-center w-8 h-8 cursor-pointer" @click="closeCategories">
          <Icon class="text-slate-800'" name="ph:x" size="18"/>
        </div>
        <div class="w-full text-sm justify-center items-center Estedad_FD_Bold flex"> یک دسته بندی را انتخاب کنید </div>
        <div v-for="(it,i) in props.workFields"
             :key="`search_${i}`"
             class="cursor-pointer transition-all ease-in-out hover:bg-blue-500 hover:text-white px-5 py-2"  @click="selectCategory(it)">
          <span class="text-sm">{{it.title}}</span>
        </div>
      </div>
      <!--#endregion-->
      <!--#region Selected-->
      <div v-if="selectedPolygon" class="flex flex-col relative rounded-lg shadow-lg bg-linear-to-b from-white to-gray-50 border border-gray-300 gap-y-3 p-5">
        <div class="absolute top-5 -left-4 rounded-lg border border-gray-300 bg-white flex justify-center items-center w-8 h-8 cursor-pointer" @click="clearSelect">
          <Icon class="text-slate-800'" name="ph:x" size="18"/>
        </div>
        <div class="w-full flex justify-center items-center">
          <img :src="selectedPolygon.company.logo" alt="logo" class="w-50 h-50 object-cover"/>
        </div>
        <span class="Estedad_FD_Bold w-full text-center text-xl"> {{selectedPolygon.company.title}} </span>
        <span class="text-xs">جایگاه غرفه : {{selectedPolygon.polygon.boothCode}} </span>
        <span class="text-xs">سازمان : {{selectedPolygon.company.organ.title}}  ( {{selectedPolygon.company.organ.ceo}} )</span>
        <div class="flex gap-x-2">
          <span v-for="(it,i) in selectedPolygon.company.workFields" :key="`workfields_${i}`" class="rounded-lg px-2 py-1 border border-gray-300 bg-gray-200 text-xs"> {{it}} </span>
        </div>
        <div class="flex gap-x-2 justify-end items-center mt-5">
          <a :href="`https://web.pavilionnetwork.ir/exhibit-organizations/${selectedPolygon.company.organ.id}`" target="_blank" class="rounded-sm px-2 py-1 border border-blue-700 bg-blue-500 text-sm text-center text-white w-32"> پروفایل شرکت </a>
          <div class="rounded-sm px-2 py-1 border border-blue-700 bg-blue-500 text-sm text-center text-white w-32 cursor-pointer"> مسیریابی به اینجا </div>
        </div>
      </div>
      <!--#endregion-->
    </div>
    <!--#endregion-->
    <!--#region Filters : Mobile-->
    <div v-if="device.isMobile" class="flex flex-col top-3 right-0 gap-y-3 fixed w-[100dvw] px-2">
      <!--#region Search-->
      <div class="w-full flex gap-x-2">
        <div class="relative w-[85dvw]">
          <input v-if="!isOpenCategories" type="text" v-model="search" placeholder="جستجو ..." class="bg-white px-4 py-2 z-10 border border-gray-300 rounded-xl text-lg w-full">
          <div v-if="search" class="absolute top-2 left-2 rounded-lg border border-gray-200 bg-white flex justify-center items-center w-8 h-8 transition all ease-in-out cursor-pointer opacity-50 hover:opacity-100 " @click="clearSearch">
            <Icon class="text-slate-800'" name="ph:x" size="18"/>
          </div>
        </div>
        <div class="relative w-[15dvw]">
          <div class="rounded-lg border border-gray-200 bg-white flex justify-center items-center w-full h-full transition all ease-in-out cursor-pointer" @click="back">
            <Icon name="ph:caret-left" class="text-slate-800" size="18"/>
          </div>
        </div>
      </div>
      <!--#endregion-->
      <!--#region Search Result-->
      <div v-if="SearchResult" class="flex flex-col rounded-b-lg -translate-y-5 shadow-lg max-h-[40dvh] overflow-auto bg-linear-to-b from-white to-gray-50 border border-gray-300 gap-y-4 p-5">
        <div v-for="(it,i) in SearchResult"
             :key="`search_${i}`"
             class="cursor-pointer transition-all ease-in-out hover:pr-3"
             @click="selectCompany(it)">
          <span class="text-sm">{{it.title}}</span>
          <div class="flex gap-x-2 mt-1">
           <span v-for="(wk,j) in it.workFields"
                 :key="`search_workfields_${j}`"
                 class="rounded-lg px-2 py-1 border border-gray-300 bg-gray-200 text-xs">
             {{wk}}
           </span>
          </div>
        </div>
      </div>
      <!--#endregion-->
      <!--#region Categories-->
      <div v-if="!SearchResult && !selectedPolygon && !isOpenCategories" class="flex justify-between items-center gap-x-2">
        <div class="bg-white border border-gray-300 flex justify-center items-center px-2 py-2 text-sm rounded-xl cursor-pointer" @click="openCategories"> دسته بندی ها </div>
        <div class="flex gap-x-2 justify-center items-center">
          <span v-if="routingMode" class="text-xs Estedad_FD_Light px-3 py-1 animate-pulse bg-indigo-800 text-white rounded-lg"> مبدا و سپس مقصد را مشخص کنید </span>
          <div
              :class="routingMode ? 'bg-rose-500 border-rose-700' : 'bg-blue-500 border-blue-700'"
              class="shadow-lg text-white rounded-xl p-1 px-4 border flex justify-center items-center cursor-pointer hover:bg-purple-600" @click="toggleRouting">
            {{ routingMode ? 'پایان' : 'مسیریابی' }}
          </div>
        </div>
      </div>
      <!--#endregion-->
      <!--#region Category Result-->
      <div v-if="isOpenCategories" class="flex flex-col rounded-lg relative shadow-lg max-h-[75dvh] bg-linear-to-b from-white to-gray-50 border border-gray-300 py-5 gap-y-2">
        <div class="absolute top-5 -left-4 rounded-lg border border-gray-300 bg-white flex justify-center items-center w-8 h-8 cursor-pointer" @click="closeCategories">
          <Icon class="text-slate-800'" name="ph:x" size="18"/>
        </div>
        <div class="w-full text-sm justify-center items-center Estedad_FD_Bold flex"> یک دسته بندی را انتخاب کنید </div>
        <div v-for="(it,i) in props.workFields"
             :key="`search_${i}`"
             class="cursor-pointer transition-all ease-in-out hover:bg-blue-500 hover:text-white px-5 py-2"  @click="selectCategory(it)">
          <span class="text-sm">{{it.title}}</span>
        </div>
      </div>
      <!--#endregion-->
    </div>
    <!--#endregion-->
    <!--#region Selected Company : Mobile-->
    <div v-if="device.isMobile" class="flex flex-col bottom-1 right-0 gap-y-3 fixed w-[100dvw] px-2 z-50">
      <!--#region Selected-->
      <div v-if="selectedPolygon" class="flex flex-col relative rounded-lg shadow-lg bg-linear-to-b from-white to-gray-50 border border-gray-300 gap-y-3 p-5">
        <div class="absolute top-2 left-2 rounded-lg border border-gray-300 bg-white flex justify-center items-center w-8 h-8 cursor-pointer" @click="clearSelect">
          <Icon class="text-slate-800'" name="ph:x" size="18"/>
        </div>
        <div class="w-full flex justify-center items-center">
          <img :src="selectedPolygon.company.logo" alt="logo" class="w-35 h-35 object-cover"/>
        </div>
        <span class="Estedad_FD_Bold w-full text-center text-xl"> {{selectedPolygon.company.title}} </span>
        <span class="text-xs">جایگاه غرفه : {{selectedPolygon.polygon.boothCode}} </span>
        <span class="text-xs">سازمان : {{selectedPolygon.company.organ.title}}  ( {{selectedPolygon.company.organ.ceo}} )</span>
        <div class="flex gap-x-2">
          <span v-for="(it,i) in selectedPolygon.company.workFields" :key="`workfields_${i}`" class="rounded-lg px-2 py-1 border border-gray-300 bg-gray-200 text-xs"> {{it}} </span>
        </div>
        <div class="flex gap-x-2 justify-between items-center mt-3">
          <a :href="`https://web.pavilionnetwork.ir/exhibit-organizations/${selectedPolygon.company.organ.id}`" target="_blank" class="rounded-sm px-2 py-1 border border-blue-700 bg-blue-500 text-sm text-center text-white w-32"> پروفایل شرکت </a>
          <div class="rounded-sm px-2 py-1 border border-blue-700 bg-blue-500 text-sm text-center text-white w-32 cursor-pointer"> مسیریابی به اینجا </div>
        </div>
      </div>
      <!--#endregion-->
    </div>
    <!--#endregion-->
    <!--#region Footer Copyright : Mobile-->
    <div v-if="device.isMobile" class="fixed flex flex-col justify-center items-center bottom-3 left-0 w-[100dvw] text-xs text-slate-600 opacity-80 gap-y-2">
      <!--#region Map Title-->
      <div class="flex w-full justify-center items-center"> <span class="Estedad_FD_Bold text-xs line-clamp-1">{{props.title}}</span> </div>
      <!--#endregion-->
      <!--#region Copyright-->
      <div class="flex text-xs text-slate-600 bg-gray-100 border border-gray-300 px-2 py-1 gap-x-2 rounded-lg  transition-all ease-in-out opacity-70 hover:opacity-100 ">
        <span> توسعه یافته در </span>
        <a href="https://pavilionnetwork.ir" target="_blank"> پاویون </a>
        <span> و </span>
        <a href="https://i-cap.ir/" target="_blank"> چشم انداز آینده پارسیان </a>
      </div>
      <!--#endregion-->
    </div>
    <!--#endregion-->
    <!--#region Footer Copyright : Desktop-->
    <div v-if="!device.isMobile" class="fixed flex bottom-3 left-3 text-xs text-slate-600 bg-gray-100 border border-gray-300 px-2 py-1 gap-x-2 rounded-lg  transition-all ease-in-out opacity-70 hover:opacity-100 ">
      <span> توسعه یافته در </span>
      <a href="https://pavilionnetwork.ir" target="_blank"> پاویون </a>
      <span> و </span>
      <a href="https://i-cap.ir/" target="_blank"> چشم انداز آینده پارسیان </a>
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
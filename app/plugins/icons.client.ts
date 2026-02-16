import { addCollection } from '@iconify/vue'
import ph from '@iconify-json/ph/icons.json'
import solar from '@iconify-json/solar/icons.json'
import lucide from '@iconify-json/lucide/icons.json'

export default defineNuxtPlugin(() => {
    addCollection(solar)
  addCollection(ph)
    addCollection(lucide)
})

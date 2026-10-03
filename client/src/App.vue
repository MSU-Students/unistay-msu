
<template>
  <router-view/>
</template>

<script setup lang="ts">
import { ref } from 'vue';


const message = 'Hello THere!';
const members = ref([
  'Luffy',
  'Zoro',
  'Usop'
]);
const newMember = ref('');

function enteringNaXa(){
  members.value.push(newMember.value);
  newMember.value = '';
}
</script>
<style lang="css" scoped>
.my-input {
  border: 1px solid black;
  width: 100%;
}
.input-error {
  border: 5px solid red;
}
</style>

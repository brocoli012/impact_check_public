/**
 * @module tests/unit/indexing/vue-parser
 * @description VueParser 단위 테스트
 */

import { VueParser } from '../../../src/core/indexing/parsers/vue-parser';

describe('VueParser', () => {
  let parser: VueParser;

  beforeEach(() => {
    parser = new VueParser();
  });

  describe('canParse()', () => {
    it('should support .vue files', () => {
      expect(parser.canParse('App.vue')).toBe(true);
      expect(parser.canParse('src/components/MyComponent.vue')).toBe(true);
    });

    it('should not support non-vue files', () => {
      expect(parser.canParse('file.ts')).toBe(false);
      expect(parser.canParse('file.js')).toBe(false);
      expect(parser.canParse('file.tsx')).toBe(false);
    });
  });

  describe('Options API (defineComponent)', () => {
    it('should parse defineComponent with imports', async () => {
      const code = `
<template>
  <div>{{ message }}</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import axios from 'axios';

export default defineComponent({
  name: 'HelloWorld',
  props: {
    msg: String,
  },
  data() {
    return { message: 'hello' };
  },
});
</script>
`;
      const result = await parser.parse('HelloWorld.vue', code);

      expect(result.imports.length).toBeGreaterThanOrEqual(2);
      expect(result.imports.find(i => i.source === 'vue')).toBeTruthy();
      expect(result.imports.find(i => i.source === 'axios')).toBeTruthy();

      // defineComponent 감지
      const defineCompFunc = result.functions.find(f => f.name === 'defineComponent');
      expect(defineCompFunc).toBeTruthy();
    });
  });

  describe('Composition API (<script setup>)', () => {
    it('should parse <script setup> with ref, computed, watch', async () => {
      const code = `
<template>
  <div>{{ count }}</div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const count = ref(0);
const doubled = computed(() => count.value * 2);

watch(count, (newVal) => {
  console.log('count changed:', newVal);
});

function increment() {
  count.value++;
}
</script>
`;
      const result = await parser.parse('Counter.vue', code);

      expect(result.imports.length).toBeGreaterThanOrEqual(1);
      const vueImport = result.imports.find(i => i.source === 'vue');
      expect(vueImport).toBeTruthy();
      expect(vueImport!.specifiers).toContain('ref');
      expect(vueImport!.specifiers).toContain('computed');
      expect(vueImport!.specifiers).toContain('watch');

      // Vue 패턴 감지
      expect(result.functions.find(f => f.name === 'ref')).toBeTruthy();
      expect(result.functions.find(f => f.name === 'computed')).toBeTruthy();
      expect(result.functions.find(f => f.name === 'watch')).toBeTruthy();

      // increment 함수 감지
      expect(result.functions.find(f => f.name === 'increment')).toBeTruthy();
    });

    it('should parse defineProps and defineEmits', async () => {
      const code = `
<template>
  <button @click="$emit('click')">{{ label }}</button>
</template>

<script setup lang="ts">
const props = defineProps<{ label: string }>();
const emit = defineEmits<{ (e: 'click'): void }>();
</script>
`;
      const result = await parser.parse('MyButton.vue', code);

      expect(result.functions.find(f => f.name === 'defineProps')).toBeTruthy();
      expect(result.functions.find(f => f.name === 'defineEmits')).toBeTruthy();
    });
  });

  describe('import/export extraction', () => {
    it('should extract imports from script block', async () => {
      const code = `
<script lang="ts">
import { ref } from 'vue';
import MyService from '../services/MyService';
import { formatDate, formatCurrency } from '../utils/format';
</script>
`;
      const result = await parser.parse('Test.vue', code);

      expect(result.imports.length).toBe(3);
      expect(result.imports[0].source).toBe('vue');
      expect(result.imports[1].source).toBe('../services/MyService');
      expect(result.imports[1].isDefault).toBe(true);
      expect(result.imports[2].specifiers).toContain('formatDate');
      expect(result.imports[2].specifiers).toContain('formatCurrency');
    });

    it('should extract exports', async () => {
      const code = `
<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'MyComp',
});
</script>
`;
      const result = await parser.parse('MyComp.vue', code);
      expect(result.exports.find(e => e.type === 'default')).toBeTruthy();
    });
  });

  describe('Vue pattern detection', () => {
    it('should detect reactive, provide, inject', async () => {
      const code = `
<script setup lang="ts">
import { reactive, provide, inject } from 'vue';

const state = reactive({ count: 0 });
provide('state', state);
const injected = inject('state');
</script>
`;
      const result = await parser.parse('Provider.vue', code);

      expect(result.functions.find(f => f.name === 'reactive')).toBeTruthy();
      expect(result.functions.find(f => f.name === 'provide')).toBeTruthy();
      expect(result.functions.find(f => f.name === 'inject')).toBeTruthy();
    });

    it('should detect watchEffect', async () => {
      const code = `
<script setup lang="ts">
import { ref, watchEffect } from 'vue';

const count = ref(0);
watchEffect(() => console.log(count.value));
</script>
`;
      const result = await parser.parse('Watch.vue', code);
      expect(result.functions.find(f => f.name === 'watchEffect')).toBeTruthy();
    });

    it('should detect Pinia defineStore', async () => {
      const code = `
<script lang="ts">
import { defineStore } from 'pinia';

export const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0 }),
});
</script>
`;
      const result = await parser.parse('store.vue', code);
      expect(result.functions.find(f => f.name === 'defineStore')).toBeTruthy();
    });

    it('should detect Vue Router patterns', async () => {
      const code = `
<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();
</script>
`;
      const result = await parser.parse('RouterUser.vue', code);
      expect(result.functions.find(f => f.name === 'useRouter')).toBeTruthy();
      expect(result.functions.find(f => f.name === 'useRoute')).toBeTruthy();
    });
  });

  describe('template component detection', () => {
    it('should detect PascalCase custom components in template', async () => {
      const code = `
<template>
  <div>
    <MyHeader />
    <UserList :users="users" />
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import MyHeader from './MyHeader.vue';
import UserList from './UserList.vue';
import AppFooter from './AppFooter.vue';
import { ref } from 'vue';

const users = ref([]);
</script>
`;
      const result = await parser.parse('App.vue', code);

      const compNames = result.components.map(c => c.name);
      expect(compNames).toContain('MyHeader');
      expect(compNames).toContain('UserList');
      expect(compNames).toContain('AppFooter');
    });

    it('should not detect HTML built-in tags as components', async () => {
      const code = `
<template>
  <div>
    <span>text</span>
    <button>click</button>
    <input type="text" />
  </div>
</template>

<script setup lang="ts">
</script>
`;
      const result = await parser.parse('Basic.vue', code);
      expect(result.components.length).toBe(0);
    });

    it('should detect kebab-case custom components', async () => {
      const code = `
<template>
  <div>
    <my-header />
    <user-list />
  </div>
</template>

<script setup lang="ts">
import MyHeader from './MyHeader.vue';
import UserList from './UserList.vue';
</script>
`;
      const result = await parser.parse('App.vue', code);
      const compNames = result.components.map(c => c.name);
      expect(compNames).toContain('MyHeader');
      expect(compNames).toContain('UserList');
    });
  });

  describe('empty and edge cases', () => {
    it('should handle empty content', async () => {
      const result = await parser.parse('Empty.vue', '');
      expect(result.imports).toEqual([]);
      expect(result.functions).toEqual([]);
    });

    it('should handle vue file without script block', async () => {
      const code = `
<template>
  <div>Static content</div>
</template>

<style scoped>
div { color: red; }
</style>
`;
      const result = await parser.parse('Static.vue', code);
      expect(result.imports).toEqual([]);
    });

    it('should handle JavaScript (no lang attr) script block', async () => {
      const code = `
<script>
import { ref } from 'vue';
export default {
  setup() {
    const count = ref(0);
    return { count };
  }
};
</script>
`;
      const result = await parser.parse('JsComp.vue', code);
      expect(result.imports.length).toBeGreaterThanOrEqual(1);
      expect(result.imports[0].source).toBe('vue');
    });

    it('should handle both script and script setup blocks', async () => {
      const code = `
<script lang="ts">
export interface Props {
  title: string;
}
</script>

<script setup lang="ts">
import { ref } from 'vue';
const count = ref(0);
</script>
`;
      const result = await parser.parse('Dual.vue', code);
      expect(result.imports.find(i => i.source === 'vue')).toBeTruthy();
    });
  });
});

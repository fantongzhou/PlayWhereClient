<script setup lang="ts">
// Landing page - no script logic needed for static content
const features = [
  {
    icon: '💬',
    title: '自然语言对话',
    desc: '像和朋友聊天一样描述旅行需求，AI 自动理解您的偏好、天数、预算，无需复杂表单。',
  },
  {
    icon: '⚡',
    title: '秒级行程生成',
    desc: '基于大模型实时推理，从城市、景点、酒店到交通路线，数秒内生成完整可执行的旅行计划。',
  },
  {
    icon: '🎯',
    title: '飞猪真实数据',
    desc: '景点、餐厅、酒店均来自飞猪酒旅真实数据，价格透明，支持一键预订。',
  },
  {
    icon: '🌤️',
    title: '实时天气集成',
    desc: '自动查询目的地天气，根据天气状况智能调整行程建议，雨天推荐室内景点。',
  },
  {
    icon: '🗺️',
    title: '高德地图导航',
    desc: '多模式路线规划（驾车/步行/骑行/公交），地图可视化展示每日行程轨迹。',
  },
  {
    icon: '📱',
    title: '多端随时访问',
    desc: '响应式设计，PC 端规划、手机端查看，行程链接一键分享给同行伙伴。',
  },
];

const steps = [
  { step: '01', title: '描述您的旅行需求', desc: '用自然语言告诉AI：目的地、天数、偏好、预算——就像跟旅行顾问聊天一样简单。' },
  { step: '02', title: 'AI 智能分析与规划', desc: 'DeepSeek 大模型自动分析需求，结合飞猪真实数据和高德地图，秒级生成个性化行程。' },
  { step: '03', title: '查看与调整行程', desc: '地图上可视化查看完整路线，自由切换交通方式，调整景点顺序——一切尽在掌控。' },
  { step: '04', title: '一键预订出发', desc: '确认行程后，直接通过飞猪链接预订酒店和门票，开启完美旅程。' },
];
</script>

<template>
  <div class="min-h-screen bg-white font-sans">
    <!-- ==================== Nav ==================== -->
    <header class="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <nav class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 bg-indigo-700 rounded-lg flex items-center justify-center text-white font-bold text-sm">S</div>
          <span class="text-lg font-semibold text-slate-900 tracking-tight">Stitch AI</span>
        </div>
        <div class="hidden md:flex items-center gap-8">
          <a href="#features" class="text-sm text-slate-500 hover:text-slate-900 transition-colors">功能</a>
          <a href="#how" class="text-sm text-slate-500 hover:text-slate-900 transition-colors">如何使用</a>
          <a href="#faq" class="text-sm text-slate-500 hover:text-slate-900 transition-colors">常见问题</a>
        </div>
        <a
          href="/plan"
          class="bg-indigo-700 hover:bg-indigo-800 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm"
        >
          开始使用
        </a>
      </nav>
    </header>

    <!-- ==================== Hero ==================== -->
    <section class="relative overflow-hidden bg-gradient-to-b from-white via-white to-slate-50/50">
      <div class="max-w-4xl mx-auto px-6 pt-24 pb-12 text-center relative z-10">
        <!-- Badge -->
        <div class="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full text-sm text-indigo-700 font-medium mb-8">
          <span class="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
          现已支持 DeepSeek 大模型
        </div>

        <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight tracking-tight">
          用 AI 重新定义<br/>
          <span class="text-indigo-700">旅行规划</span>的方式
        </h1>
        <p class="mt-6 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
          只需用自然语言描述需求，AI 自动分析目的地、天数、偏好和预算，
          基于飞猪真实数据和高德地图，秒级生成完整旅行计划。
        </p>

        <div class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="/plan"
            class="w-full sm:w-auto bg-indigo-700 hover:bg-indigo-800 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 hover:-translate-y-0.5"
          >
            免费开始规划 →
          </a>
          <a
            href="#features"
            class="w-full sm:w-auto bg-white hover:bg-slate-50 border border-gray-200 text-slate-700 px-8 py-3.5 rounded-xl text-base font-medium transition-all"
          >
            了解更多
          </a>
        </div>

        <p class="mt-6 text-xs text-slate-400">
          无需注册 · 完全免费 · 基于真实数据
        </p>
      </div>

      <!-- Decorative subtle gradient blob -->
      <div class="absolute -top-40 -right-40 w-96 h-96 bg-indigo-100/40 rounded-full blur-3xl pointer-events-none" />
      <div class="absolute -bottom-20 -left-20 w-72 h-72 bg-blue-100/30 rounded-full blur-3xl pointer-events-none" />
    </section>

    <!-- ==================== Features ==================== -->
    <section id="features" class="py-24 bg-white">
      <div class="max-w-6xl mx-auto px-6">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold text-slate-900 tracking-tight">为什么选择 Stitch AI</h2>
          <p class="mt-3 text-slate-500 max-w-xl mx-auto">不只是行程规划——而是从灵感到出发的一站式旅行助手</p>
        </div>

        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="(feat, i) in features"
            :key="i"
            class="group p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-300"
          >
            <div class="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-2xl mb-5 group-hover:bg-indigo-50 transition-colors">
              {{ feat.icon }}
            </div>
            <h3 class="text-base font-semibold text-slate-900 mb-2">{{ feat.title }}</h3>
            <p class="text-sm text-slate-500 leading-relaxed">{{ feat.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== How It Works ==================== -->
    <section id="how" class="py-24 bg-slate-50/80">
      <div class="max-w-4xl mx-auto px-6">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold text-slate-900 tracking-tight">三步开启完美旅程</h2>
          <p class="mt-3 text-slate-500">像聊天一样简单，全程无需手动填写复杂信息</p>
        </div>

        <div class="space-y-8">
          <div
            v-for="(item, i) in steps"
            :key="i"
            class="flex flex-col md:flex-row gap-6 items-start group"
          >
            <!-- Step number -->
            <div class="shrink-0 w-16 h-16 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center text-xl font-bold text-indigo-600 group-hover:bg-indigo-50 group-hover:border-indigo-200 transition-all">
              {{ item.step }}
            </div>
            <!-- Content -->
            <div class="flex-1 pt-1">
              <h3 class="text-lg font-semibold text-slate-900">{{ item.title }}</h3>
              <p class="mt-2 text-slate-500 leading-relaxed">{{ item.desc }}</p>
            </div>
            <!-- Connector line (not on last item) -->
            <div v-if="i < steps.length - 1" class="hidden md:block absolute left-8 w-px h-8 bg-gray-200" style="margin-top:64px;margin-left:31px" />
          </div>
        </div>
      </div>
    </section>

    <!-- ==================== CTA Banner ==================== -->
    <section class="py-24 bg-white">
      <div class="max-w-3xl mx-auto px-6 text-center">
        <div class="bg-gradient-to-br from-indigo-700 via-indigo-600 to-blue-700 rounded-3xl p-12 md:p-16 shadow-xl shadow-indigo-200/50">
          <h2 class="text-2xl md:text-3xl font-bold text-white tracking-tight">
            准备好规划您的下一次旅行了吗？
          </h2>
          <p class="mt-4 text-indigo-100 text-base max-w-md mx-auto">
            无需注册，直接开始对话。AI 会在几秒内为您生成专属旅行方案。
          </p>
          <a
            href="/plan"
            class="mt-8 inline-block bg-white hover:bg-indigo-50 text-indigo-700 px-8 py-3.5 rounded-xl text-base font-semibold transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            立即免费体验 →
          </a>
        </div>
      </div>
    </section>

    <!-- ==================== Footer ==================== -->
    <footer class="border-t border-gray-100 bg-white">
      <div class="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 bg-indigo-700 rounded flex items-center justify-center text-white font-bold text-xs">S</div>
          <span class="text-sm font-medium text-slate-600">Stitch AI Travel</span>
        </div>
        <div class="flex items-center gap-6">
          <a href="#" class="text-xs text-slate-400 hover:text-slate-600 transition-colors">关于我们</a>
          <a href="#" class="text-xs text-slate-400 hover:text-slate-600 transition-colors">隐私政策</a>
          <a href="#" class="text-xs text-slate-400 hover:text-slate-600 transition-colors">使用条款</a>
        </div>
        <p class="text-xs text-slate-400">
          © 2024 Stitch AI. Powered by DeepSeek · 高德地图 · 飞猪
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const tripStore = useTripStore();
useRoutes();

// 工具数量：6 个内置 + 3 个美团 = 9
const agentToolsCount = 9;
</script>

<template>
  <div class="planner">
    <!-- 顶部搜索栏 -->
    <SearchBar />

    <!-- 主体区域 -->
    <div class="main-content" v-if="tripStore.plan">
      <div class="map-panel">
        <ClientOnly fallback-tag="div" fallback="地图加载中...">
          <TravelMap />
        </ClientOnly>
      </div>
      <div class="right-panel">
        <ThinkingPanel />
        <TimelinePanel />
      </div>
    </div>

    <!-- 空状态 -->
    <div class="empty-state" v-if="!tripStore.plan && !tripStore.loading">
      <div class="empty-icon">🗺️</div>
      <h2>AI 旅行规划 Agent</h2>
      <p>选择国内目的地与偏好，AI 通过美团酒旅数据为你规划完美旅程</p>
      <div class="empty-features">
        <div class="feature">
          <span class="feature-icon">🏨</span>
          <span>美团酒店/门票/机票实时数据</span>
        </div>
        <div class="feature">
          <span class="feature-icon">🔧</span>
          <span>{{ agentToolsCount }} 个工具自动调用</span>
        </div>
        <div class="feature">
          <span class="feature-icon">📊</span>
          <span>实时思考过程可视化</span>
        </div>
      </div>
      <div class="mode-links">
        <span>或试试</span>
        <NuxtLink to="/chat" class="chat-link">💬 自由对话模式（更灵活的美团查询）</NuxtLink>
      </div>
    </div>

    <!-- 加载中 -->
    <LoadingOverlay v-if="tripStore.loading" />
  </div>
</template>

<style scoped>
.planner {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.map-panel {
  width: 45%;
  height: 100%;
  border-right: 1px solid var(--border);
}

.right-panel {
  width: 55%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 8px;
}

.empty-state h2 {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--primary), #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.empty-state > p {
  color: var(--text-secondary);
  font-size: 15px;
}

.empty-features {
  display: flex;
  gap: 24px;
  margin-top: 24px;
}

.feature {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 24px;
  background: var(--bg-card);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  font-size: 13px;
  color: var(--text-secondary);
}

.feature-icon {
  font-size: 28px;
}

.mode-links {
  margin-top: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.chat-link {
  color: var(--primary);
  font-weight: 500;
}
</style>

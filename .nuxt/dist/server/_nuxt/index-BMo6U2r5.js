import { ref, defineComponent, mergeProps, unref, useSSRContext, watch, nextTick } from "vue";
import { ssrRenderAttrs, ssrRenderList, ssrRenderClass, ssrInterpolate, ssrIncludeBooleanAttr, ssrRenderStyle, ssrRenderComponent } from "vue/server-renderer";
import { d as defineStore, _ as _export_sfc, f as __nuxt_component_1 } from "../server.mjs";
import "/Users/tongzhoufan/travel-agent/client/node_modules/ofetch/dist/node.mjs";
import "#internal/nuxt/paths";
import "/Users/tongzhoufan/travel-agent/client/node_modules/hookable/dist/index.mjs";
import "/Users/tongzhoufan/travel-agent/client/node_modules/unctx/dist/index.mjs";
import "/Users/tongzhoufan/travel-agent/client/node_modules/h3/dist/index.mjs";
import "vue-router";
import "/Users/tongzhoufan/travel-agent/client/node_modules/defu/dist/defu.mjs";
import "/Users/tongzhoufan/travel-agent/client/node_modules/ufo/dist/index.mjs";
import "/Users/tongzhoufan/travel-agent/client/node_modules/klona/dist/index.mjs";
const useTripStore = defineStore("trip", () => {
  const loading = ref(false);
  const request = ref(null);
  const plan = ref(null);
  const activeDay = ref(1);
  const routesByDay = ref({});
  function setRequest(req) {
    request.value = req;
    plan.value = null;
    activeDay.value = 1;
    routesByDay.value = {};
  }
  function setPlan(p) {
    plan.value = p;
    loading.value = false;
  }
  function setRoutesForDay(day, routes) {
    routesByDay.value[day] = routes;
  }
  function getRoutesForDay(day) {
    return routesByDay.value[day] || [];
  }
  function getActiveDay() {
    if (!plan.value) return null;
    return plan.value.days.find((d) => d.day === activeDay.value) || null;
  }
  function reorderActivity(dayIndex, fromIndex, toIndex) {
    if (!plan.value) return;
    const day = plan.value.days[dayIndex];
    const [moved] = day.activities.splice(fromIndex, 1);
    day.activities.splice(toIndex, 0, moved);
  }
  return {
    loading,
    request,
    plan,
    activeDay,
    routesByDay,
    setRequest,
    setPlan,
    setRoutesForDay,
    getRoutesForDay,
    getActiveDay,
    reorderActivity
  };
});
const useAgentStore = defineStore("agent", () => {
  const thinking = ref(false);
  const steps = ref([]);
  function addStep(step) {
    steps.value.push(step);
  }
  function clearSteps() {
    steps.value = [];
  }
  return { thinking, steps, addStep, clearSteps };
});
function useSSE() {
  const isStreaming = ref(false);
  const error = ref(null);
  const tripStore = useTripStore();
  const agentStore = useAgentStore();
  async function startPlanning(request) {
    isStreaming.value = true;
    error.value = null;
    tripStore.loading = true;
    agentStore.thinking = true;
    agentStore.clearSteps();
    tripStore.setRequest(request);
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }
      const decoder = new TextDecoder();
      let buffer = "";
      let finalPlan = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              const stepTypes = ["thought", "action", "observation", "plan_partial"];
              if (stepTypes.includes(event.type)) {
                agentStore.addStep({
                  type: event.type,
                  step: event.step || 0,
                  content: event.content,
                  tool: event.tool,
                  args: event.args,
                  data: event.data
                });
              }
              if (event.type === "plan_complete" && event.plan) {
                finalPlan = event.plan;
                tripStore.setPlan(event.plan);
              }
              if (event.type === "error") {
                error.value = event.message;
              }
            } catch {
            }
          }
        }
      }
      return finalPlan;
    } catch (e) {
      error.value = e.message;
      return null;
    } finally {
      isStreaming.value = false;
      tripStore.loading = false;
      agentStore.thinking = false;
    }
  }
  return { isStreaming, error, startPlanning };
}
const CITIES = ["京都", "东京", "大阪"];
const PREFERENCES = [
  { label: "文化历史", icon: "🏛️" },
  { label: "自然风光", icon: "🏔️" },
  { label: "美食购物", icon: "🍣" },
  { label: "娱乐休闲", icon: "🎢" },
  { label: "亲子游", icon: "👨‍👩‍👧" }
];
const BUDGETS = [
  { label: "经济", value: "budget", icon: "💰" },
  { label: "适中", value: "moderate", icon: "💎" },
  { label: "奢华", value: "luxury", icon: "👑" }
];
const _sfc_main$6 = /* @__PURE__ */ defineComponent({
  __name: "SearchBar",
  __ssrInlineRender: true,
  setup(__props) {
    const { isStreaming, error } = useSSE();
    const city = ref("京都");
    const days = ref(5);
    const selectedPrefs = ref([]);
    const budget = ref("moderate");
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<header${ssrRenderAttrs(mergeProps({ class: "search-bar" }, _attrs))} data-v-d4b489b6><div class="search-row" data-v-d4b489b6><div class="field-group" data-v-d4b489b6><label data-v-d4b489b6>目的地</label><div class="city-tabs" data-v-d4b489b6><!--[-->`);
      ssrRenderList(unref(CITIES), (c) => {
        _push(`<button class="${ssrRenderClass(["city-btn", { active: city.value === c }])}" data-v-d4b489b6>${ssrInterpolate(c)}</button>`);
      });
      _push(`<!--]--></div></div><div class="field-group" data-v-d4b489b6><label data-v-d4b489b6>天数</label><div class="days-control" data-v-d4b489b6><button class="days-btn"${ssrIncludeBooleanAttr(unref(isStreaming)) ? " disabled" : ""} data-v-d4b489b6>−</button><span class="days-value" data-v-d4b489b6>${ssrInterpolate(days.value)} 天</span><button class="days-btn"${ssrIncludeBooleanAttr(unref(isStreaming)) ? " disabled" : ""} data-v-d4b489b6>+</button></div></div><div class="field-group" data-v-d4b489b6><label data-v-d4b489b6>偏好</label><div class="pref-tags" data-v-d4b489b6><!--[-->`);
      ssrRenderList(unref(PREFERENCES), (p) => {
        _push(`<button class="${ssrRenderClass(["pref-tag", { active: selectedPrefs.value.includes(p.label) }])}" data-v-d4b489b6>${ssrInterpolate(p.icon)} ${ssrInterpolate(p.label)}</button>`);
      });
      _push(`<!--]--></div></div><div class="field-group" data-v-d4b489b6><label data-v-d4b489b6>预算</label><div class="budget-tabs" data-v-d4b489b6><!--[-->`);
      ssrRenderList(unref(BUDGETS), (b) => {
        _push(`<button class="${ssrRenderClass(["budget-btn", { active: budget.value === b.value }])}" data-v-d4b489b6>${ssrInterpolate(b.icon)} ${ssrInterpolate(b.label)}</button>`);
      });
      _push(`<!--]--></div></div><button class="submit-btn"${ssrIncludeBooleanAttr(unref(isStreaming)) ? " disabled" : ""} data-v-d4b489b6>${ssrInterpolate(unref(isStreaming) ? "规划中..." : "开始规划 🚀")}</button></div>`);
      if (unref(error)) {
        _push(`<div class="error-msg" data-v-d4b489b6>${ssrInterpolate(unref(error))}</div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</header>`);
    };
  }
});
const _sfc_setup$6 = _sfc_main$6.setup;
_sfc_main$6.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/SearchBar.vue");
  return _sfc_setup$6 ? _sfc_setup$6(props, ctx) : void 0;
};
const __nuxt_component_0 = /* @__PURE__ */ _export_sfc(_sfc_main$6, [["__scopeId", "data-v-d4b489b6"]]);
const _sfc_main$5 = /* @__PURE__ */ defineComponent({
  __name: "ThinkingPanel",
  __ssrInlineRender: true,
  setup(__props) {
    const agentStore = useAgentStore();
    const expanded = ref(true);
    const listRef = ref();
    watch(() => agentStore.steps.length, async () => {
      await nextTick();
      if (listRef.value) {
        listRef.value.scrollTop = listRef.value.scrollHeight;
      }
    });
    function getStepTitle(step) {
      switch (step.type) {
        case "thought":
          return "🤔 思考";
        case "action":
          return `🔧 调用工具: ${step.tool}`;
        case "observation":
          return "📊 获取结果";
        case "plan_partial":
          return `📋 第${step.data?.day || "?"}天行程生成中`;
        default:
          return step.type;
      }
    }
    function formatData(data) {
      if (!data) return "";
      try {
        return JSON.stringify(data, null, 2);
      } catch {
        return String(data);
      }
    }
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        class: ["thinking-panel", { collapsed: !expanded.value }]
      }, _attrs))} data-v-bfe7b14d><div class="panel-header" data-v-bfe7b14d><div class="header-left" data-v-bfe7b14d>`);
      if (unref(agentStore).thinking) {
        _push(`<span class="pulse" data-v-bfe7b14d></span>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<h3 data-v-bfe7b14d>🧠 Agent 思考过程</h3><span class="step-count" data-v-bfe7b14d>${ssrInterpolate(unref(agentStore).steps.length)} 步</span></div><button class="toggle-btn" data-v-bfe7b14d>${ssrInterpolate(expanded.value ? "收起 ▲" : "展开 ▼")}</button></div><div class="steps-list" style="${ssrRenderStyle(expanded.value ? null : { display: "none" })}" data-v-bfe7b14d>`);
      if (!unref(agentStore).thinking && unref(agentStore).steps.length === 0) {
        _push(`<div class="empty-hint" data-v-bfe7b14d> 点击&quot;开始规划&quot;查看 Agent 的思考过程 </div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<!--[-->`);
      ssrRenderList(unref(agentStore).steps, (step, i) => {
        _push(`<div class="${ssrRenderClass([`step-${step.type}`, "step"])}" data-v-bfe7b14d><div class="step-header" data-v-bfe7b14d><span class="step-number" data-v-bfe7b14d>#${ssrInterpolate(step.step)}</span><span class="step-title" data-v-bfe7b14d>${ssrInterpolate(getStepTitle(step))}</span></div>`);
        if (step.content) {
          _push(`<div class="step-content" data-v-bfe7b14d>${ssrInterpolate(step.content)}</div>`);
        } else {
          _push(`<!---->`);
        }
        if (step.args && step.type === "action") {
          _push(`<div class="step-args" data-v-bfe7b14d><div class="args-label" data-v-bfe7b14d>参数:</div><pre class="args-json" data-v-bfe7b14d>${ssrInterpolate(formatData(step.args))}</pre></div>`);
        } else {
          _push(`<!---->`);
        }
        if (step.data && step.type === "observation") {
          _push(`<div class="step-obs" data-v-bfe7b14d><div class="obs-label" data-v-bfe7b14d>结果:</div><pre class="obs-json" data-v-bfe7b14d>${ssrInterpolate(formatData(step.data))}</pre></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      });
      _push(`<!--]-->`);
      if (unref(agentStore).thinking) {
        _push(`<div class="loading-dots" data-v-bfe7b14d><span data-v-bfe7b14d></span><span data-v-bfe7b14d></span><span data-v-bfe7b14d></span></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div></div>`);
    };
  }
});
const _sfc_setup$5 = _sfc_main$5.setup;
_sfc_main$5.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/ThinkingPanel.vue");
  return _sfc_setup$5 ? _sfc_setup$5(props, ctx) : void 0;
};
const __nuxt_component_2 = /* @__PURE__ */ _export_sfc(_sfc_main$5, [["__scopeId", "data-v-bfe7b14d"]]);
const _sfc_main$4 = /* @__PURE__ */ defineComponent({
  __name: "ActivityItem",
  __ssrInlineRender: true,
  props: {
    activity: {},
    index: {},
    isLast: { type: Boolean }
  },
  setup(__props) {
    const typeConfig = {
      attraction: { icon: "📍", color: "#2563eb" },
      restaurant: { icon: "🍽️", color: "#f59e0b" },
      hotel: { icon: "🏨", color: "#10b981" }
    };
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        class: ["activity", { "is-last": __props.isLast }]
      }, _attrs))} data-v-bdcc2778><div class="time-column" data-v-bdcc2778><span class="time" data-v-bdcc2778>${ssrInterpolate(__props.activity.time)}</span><div class="time-line" data-v-bdcc2778></div></div><div class="content-column" data-v-bdcc2778><div class="activity-card" data-v-bdcc2778><div class="activity-header" data-v-bdcc2778><span class="type-badge" style="${ssrRenderStyle({ background: typeConfig[__props.activity.type]?.color || "#666" })}" data-v-bdcc2778>${ssrInterpolate(typeConfig[__props.activity.type]?.icon || "📍")}</span><strong class="activity-name" data-v-bdcc2778>${ssrInterpolate(__props.activity.name)}</strong><span class="duration" data-v-bdcc2778>${ssrInterpolate(__props.activity.duration)}</span></div>`);
      if (__props.activity.note) {
        _push(`<p class="activity-note" data-v-bdcc2778>${ssrInterpolate(__props.activity.note)}</p>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div></div></div>`);
    };
  }
});
const _sfc_setup$4 = _sfc_main$4.setup;
_sfc_main$4.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/ActivityItem.vue");
  return _sfc_setup$4 ? _sfc_setup$4(props, ctx) : void 0;
};
const ActivityItem = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["__scopeId", "data-v-bdcc2778"]]);
const _sfc_main$3 = /* @__PURE__ */ defineComponent({
  __name: "DayCard",
  __ssrInlineRender: true,
  props: {
    day: {}
  },
  setup(__props) {
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "day-card" }, _attrs))} data-v-ab39fdaa>`);
      if (__props.day.weather) {
        _push(`<div class="weather-bar" data-v-ab39fdaa><div class="weather-main" data-v-ab39fdaa><span class="weather-condition" data-v-ab39fdaa>${ssrInterpolate(__props.day.weather.condition)}</span><span class="weather-temp" data-v-ab39fdaa>${ssrInterpolate(__props.day.weather.temperature.low)}° ~ ${ssrInterpolate(__props.day.weather.temperature.high)}° </span></div><div class="weather-suggestion" data-v-ab39fdaa>${ssrInterpolate(__props.day.weather.suggestion)}</div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<div class="timeline" data-v-ab39fdaa><!--[-->`);
      ssrRenderList(__props.day.activities, (activity, i) => {
        _push(ssrRenderComponent(ActivityItem, {
          key: i,
          activity,
          index: i,
          "is-last": i === __props.day.activities.length - 1
        }, null, _parent));
      });
      _push(`<!--]--></div>`);
      if (__props.day.hotel) {
        _push(`<div class="hotel-bar" data-v-ab39fdaa><span class="hotel-icon" data-v-ab39fdaa>🏨</span><div class="hotel-info" data-v-ab39fdaa><strong data-v-ab39fdaa>${ssrInterpolate(__props.day.hotel.name)}</strong><span class="hotel-price" data-v-ab39fdaa>¥${ssrInterpolate(__props.day.hotel.pricePerNight)}/晚</span></div></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});
const _sfc_setup$3 = _sfc_main$3.setup;
_sfc_main$3.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/DayCard.vue");
  return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};
const DayCard = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["__scopeId", "data-v-ab39fdaa"]]);
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "TimelinePanel",
  __ssrInlineRender: true,
  setup(__props) {
    const tripStore = useTripStore();
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "timeline-panel" }, _attrs))} data-v-8c2e030e><div class="panel-header" data-v-8c2e030e><h3 data-v-8c2e030e><span class="header-icon" data-v-8c2e030e>📋</span> ${ssrInterpolate(unref(tripStore).plan?.city)} ${ssrInterpolate(unref(tripStore).plan?.days.length)}日行程 </h3></div><div class="day-tabs" data-v-8c2e030e><!--[-->`);
      ssrRenderList(unref(tripStore).plan?.days, (day) => {
        _push(`<button class="${ssrRenderClass(["day-tab", { active: unref(tripStore).activeDay === day.day }])}" data-v-8c2e030e> Day ${ssrInterpolate(day.day)} <span class="day-weather-icon" data-v-8c2e030e>${ssrInterpolate(day.weather?.condition === "晴" ? "☀️" : day.weather?.condition === "多云" ? "⛅" : day.weather?.condition === "阴" ? "☁️" : day.weather?.condition === "小雨" ? "🌧️" : "🌤️")}</span></button>`);
      });
      _push(`<!--]--></div>`);
      if (unref(tripStore).plan?.days) {
        _push(`<div class="day-content" data-v-8c2e030e><!--[-->`);
        ssrRenderList(unref(tripStore).plan.days.filter((d) => d.day === unref(tripStore).activeDay), (day) => {
          _push(ssrRenderComponent(DayCard, {
            key: day.day,
            day
          }, null, _parent));
        });
        _push(`<!--]--></div>`);
      } else {
        _push(`<!---->`);
      }
      if (unref(tripStore).plan) {
        _push(`<div class="trip-footer" data-v-8c2e030e><div class="budget-box" data-v-8c2e030e><span class="budget-icon" data-v-8c2e030e>💵</span><span data-v-8c2e030e>${ssrInterpolate(unref(tripStore).plan.totalBudget)}</span></div>`);
        if (unref(tripStore).plan.tips.length > 0) {
          _push(`<div class="tips-box" data-v-8c2e030e><div class="tips-title" data-v-8c2e030e>💡 旅行贴士</div><ul data-v-8c2e030e><!--[-->`);
          ssrRenderList(unref(tripStore).plan.tips, (tip, i) => {
            _push(`<li data-v-8c2e030e>${ssrInterpolate(tip)}</li>`);
          });
          _push(`<!--]--></ul></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});
const _sfc_setup$2 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/TimelinePanel.vue");
  return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
const __nuxt_component_3 = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["__scopeId", "data-v-8c2e030e"]]);
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "LoadingOverlay",
  __ssrInlineRender: true,
  setup(__props) {
    const tripStore = useTripStore();
    const agentStore = useAgentStore();
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "overlay" }, _attrs))} data-v-92c44cba><div class="loading-card" data-v-92c44cba><div class="loading-icon" data-v-92c44cba>🤖</div><h3 data-v-92c44cba>AI Agent 正在规划行程</h3><p class="loading-detail" data-v-92c44cba>${ssrInterpolate(unref(tripStore).request?.city)} ${ssrInterpolate(unref(tripStore).request?.days)}日游 `);
      if (unref(tripStore).request?.preferences?.length) {
        _push(`<span data-v-92c44cba> · ${ssrInterpolate(unref(tripStore).request.preferences.join("、"))}</span>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</p><div class="progress-track" data-v-92c44cba><div class="progress-fill" data-v-92c44cba></div></div>`);
      if (unref(agentStore).steps.length > 0) {
        _push(`<div class="current-step" data-v-92c44cba><span class="step-dot" data-v-92c44cba></span><span class="step-text" data-v-92c44cba>${ssrInterpolate(unref(agentStore).steps[unref(agentStore).steps.length - 1]?.type === "thought" ? "思考中..." : unref(agentStore).steps[unref(agentStore).steps.length - 1]?.type === "action" ? `正在调用 ${unref(agentStore).steps[unref(agentStore).steps.length - 1]?.tool}...` : unref(agentStore).steps[unref(agentStore).steps.length - 1]?.type === "observation" ? "分析数据中..." : "生成行程中...")}</span></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div></div>`);
    };
  }
});
const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/LoadingOverlay.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const __nuxt_component_4 = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-92c44cba"]]);
function useRoutes() {
  const tripStore = useTripStore();
  async function fetchRoutesForDay(day) {
    const dayPlan = tripStore.plan?.days.find((d) => d.day === day);
    if (!dayPlan) return [];
    const waypoints = [];
    for (const a of dayPlan.activities) {
      if (a.lat && a.lng) {
        waypoints.push({ name: a.name, lat: a.lat, lng: a.lng });
      }
    }
    if (dayPlan.hotel && dayPlan.hotel.lat && dayPlan.hotel.lng) {
      waypoints.push({
        name: dayPlan.hotel.name,
        lat: dayPlan.hotel.lat,
        lng: dayPlan.hotel.lng
      });
    }
    if (waypoints.length < 2) return [];
    try {
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waypoints })
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.segments || [];
    } catch {
      return [];
    }
  }
  async function loadAllRoutes() {
    if (!tripStore.plan) return;
    for (const day of tripStore.plan.days) {
      const routes = await fetchRoutesForDay(day.day);
      tripStore.setRoutesForDay(day.day, routes);
    }
  }
  watch(() => tripStore.plan, (plan) => {
    if (plan) {
      loadAllRoutes();
    }
  });
  return { fetchRoutesForDay, loadAllRoutes };
}
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "index",
  __ssrInlineRender: true,
  setup(__props) {
    const tripStore = useTripStore();
    useRoutes();
    return (_ctx, _push, _parent, _attrs) => {
      const _component_SearchBar = __nuxt_component_0;
      const _component_ClientOnly = __nuxt_component_1;
      const _component_ThinkingPanel = __nuxt_component_2;
      const _component_TimelinePanel = __nuxt_component_3;
      const _component_LoadingOverlay = __nuxt_component_4;
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "planner" }, _attrs))} data-v-657e0634>`);
      _push(ssrRenderComponent(_component_SearchBar, null, null, _parent));
      if (unref(tripStore).plan) {
        _push(`<div class="main-content" data-v-657e0634><div class="map-panel" data-v-657e0634>`);
        _push(ssrRenderComponent(_component_ClientOnly, {
          "fallback-tag": "div",
          fallback: "地图加载中..."
        }, {}, _parent));
        _push(`</div><div class="right-panel" data-v-657e0634>`);
        _push(ssrRenderComponent(_component_ThinkingPanel, null, null, _parent));
        _push(ssrRenderComponent(_component_TimelinePanel, null, null, _parent));
        _push(`</div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (!unref(tripStore).plan && !unref(tripStore).loading) {
        _push(`<div class="empty-state" data-v-657e0634><div class="empty-icon" data-v-657e0634>🗺️</div><h2 data-v-657e0634>AI 旅行规划 Agent</h2><p data-v-657e0634>选择目的地与偏好，让 AI 为你规划完美旅程</p><div class="empty-features" data-v-657e0634><div class="feature" data-v-657e0634><span class="feature-icon" data-v-657e0634>🤖</span><span data-v-657e0634>多步 ReAct Agent 循环</span></div><div class="feature" data-v-657e0634><span class="feature-icon" data-v-657e0634>🔧</span><span data-v-657e0634>6 个工具自动调用</span></div><div class="feature" data-v-657e0634><span class="feature-icon" data-v-657e0634>📊</span><span data-v-657e0634>实时思考过程可视化</span></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (unref(tripStore).loading) {
        _push(ssrRenderComponent(_component_LoadingOverlay, null, null, _parent));
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("pages/index.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const index = /* @__PURE__ */ _export_sfc(_sfc_main, [["__scopeId", "data-v-657e0634"]]);
export {
  index as default
};
//# sourceMappingURL=index-BMo6U2r5.js.map

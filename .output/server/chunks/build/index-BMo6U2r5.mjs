import { defineComponent, mergeProps, unref, ref, watch, nextTick, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderComponent, ssrRenderList, ssrRenderClass, ssrInterpolate, ssrIncludeBooleanAttr, ssrRenderStyle } from 'vue/server-renderer';
import { _ as _export_sfc, f as __nuxt_component_1, d as defineStore } from './server.mjs';
import '../nitro/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import '../routes/renderer.mjs';
import 'vue-bundle-renderer/runtime';
import 'unhead/server';
import 'devalue';
import 'unhead/utils';
import 'unhead/plugins';
import 'vue-router';

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
    var _a;
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
      const reader = (_a = response.body) == null ? void 0 : _a.getReader();
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
const CITIES = ["\u4EAC\u90FD", "\u4E1C\u4EAC", "\u5927\u962A"];
const PREFERENCES = [
  { label: "\u6587\u5316\u5386\u53F2", icon: "\u{1F3DB}\uFE0F" },
  { label: "\u81EA\u7136\u98CE\u5149", icon: "\u{1F3D4}\uFE0F" },
  { label: "\u7F8E\u98DF\u8D2D\u7269", icon: "\u{1F363}" },
  { label: "\u5A31\u4E50\u4F11\u95F2", icon: "\u{1F3A2}" },
  { label: "\u4EB2\u5B50\u6E38", icon: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}" }
];
const BUDGETS = [
  { label: "\u7ECF\u6D4E", value: "budget", icon: "\u{1F4B0}" },
  { label: "\u9002\u4E2D", value: "moderate", icon: "\u{1F48E}" },
  { label: "\u5962\u534E", value: "luxury", icon: "\u{1F451}" }
];
const _sfc_main$6 = /* @__PURE__ */ defineComponent({
  __name: "SearchBar",
  __ssrInlineRender: true,
  setup(__props) {
    const { isStreaming, error } = useSSE();
    const city = ref("\u4EAC\u90FD");
    const days = ref(5);
    const selectedPrefs = ref([]);
    const budget = ref("moderate");
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<header${ssrRenderAttrs(mergeProps({ class: "search-bar" }, _attrs))} data-v-d4b489b6><div class="search-row" data-v-d4b489b6><div class="field-group" data-v-d4b489b6><label data-v-d4b489b6>\u76EE\u7684\u5730</label><div class="city-tabs" data-v-d4b489b6><!--[-->`);
      ssrRenderList(unref(CITIES), (c) => {
        _push(`<button class="${ssrRenderClass(["city-btn", { active: city.value === c }])}" data-v-d4b489b6>${ssrInterpolate(c)}</button>`);
      });
      _push(`<!--]--></div></div><div class="field-group" data-v-d4b489b6><label data-v-d4b489b6>\u5929\u6570</label><div class="days-control" data-v-d4b489b6><button class="days-btn"${ssrIncludeBooleanAttr(unref(isStreaming)) ? " disabled" : ""} data-v-d4b489b6>\u2212</button><span class="days-value" data-v-d4b489b6>${ssrInterpolate(days.value)} \u5929</span><button class="days-btn"${ssrIncludeBooleanAttr(unref(isStreaming)) ? " disabled" : ""} data-v-d4b489b6>+</button></div></div><div class="field-group" data-v-d4b489b6><label data-v-d4b489b6>\u504F\u597D</label><div class="pref-tags" data-v-d4b489b6><!--[-->`);
      ssrRenderList(unref(PREFERENCES), (p) => {
        _push(`<button class="${ssrRenderClass(["pref-tag", { active: selectedPrefs.value.includes(p.label) }])}" data-v-d4b489b6>${ssrInterpolate(p.icon)} ${ssrInterpolate(p.label)}</button>`);
      });
      _push(`<!--]--></div></div><div class="field-group" data-v-d4b489b6><label data-v-d4b489b6>\u9884\u7B97</label><div class="budget-tabs" data-v-d4b489b6><!--[-->`);
      ssrRenderList(unref(BUDGETS), (b) => {
        _push(`<button class="${ssrRenderClass(["budget-btn", { active: budget.value === b.value }])}" data-v-d4b489b6>${ssrInterpolate(b.icon)} ${ssrInterpolate(b.label)}</button>`);
      });
      _push(`<!--]--></div></div><button class="submit-btn"${ssrIncludeBooleanAttr(unref(isStreaming)) ? " disabled" : ""} data-v-d4b489b6>${ssrInterpolate(unref(isStreaming) ? "\u89C4\u5212\u4E2D..." : "\u5F00\u59CB\u89C4\u5212 \u{1F680}")}</button></div>`);
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
      var _a;
      switch (step.type) {
        case "thought":
          return "\u{1F914} \u601D\u8003";
        case "action":
          return `\u{1F527} \u8C03\u7528\u5DE5\u5177: ${step.tool}`;
        case "observation":
          return "\u{1F4CA} \u83B7\u53D6\u7ED3\u679C";
        case "plan_partial":
          return `\u{1F4CB} \u7B2C${((_a = step.data) == null ? void 0 : _a.day) || "?"}\u5929\u884C\u7A0B\u751F\u6210\u4E2D`;
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
      _push(`<h3 data-v-bfe7b14d>\u{1F9E0} Agent \u601D\u8003\u8FC7\u7A0B</h3><span class="step-count" data-v-bfe7b14d>${ssrInterpolate(unref(agentStore).steps.length)} \u6B65</span></div><button class="toggle-btn" data-v-bfe7b14d>${ssrInterpolate(expanded.value ? "\u6536\u8D77 \u25B2" : "\u5C55\u5F00 \u25BC")}</button></div><div class="steps-list" style="${ssrRenderStyle(expanded.value ? null : { display: "none" })}" data-v-bfe7b14d>`);
      if (!unref(agentStore).thinking && unref(agentStore).steps.length === 0) {
        _push(`<div class="empty-hint" data-v-bfe7b14d> \u70B9\u51FB&quot;\u5F00\u59CB\u89C4\u5212&quot;\u67E5\u770B Agent \u7684\u601D\u8003\u8FC7\u7A0B </div>`);
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
          _push(`<div class="step-args" data-v-bfe7b14d><div class="args-label" data-v-bfe7b14d>\u53C2\u6570:</div><pre class="args-json" data-v-bfe7b14d>${ssrInterpolate(formatData(step.args))}</pre></div>`);
        } else {
          _push(`<!---->`);
        }
        if (step.data && step.type === "observation") {
          _push(`<div class="step-obs" data-v-bfe7b14d><div class="obs-label" data-v-bfe7b14d>\u7ED3\u679C:</div><pre class="obs-json" data-v-bfe7b14d>${ssrInterpolate(formatData(step.data))}</pre></div>`);
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
      attraction: { icon: "\u{1F4CD}", color: "#2563eb" },
      restaurant: { icon: "\u{1F37D}\uFE0F", color: "#f59e0b" },
      hotel: { icon: "\u{1F3E8}", color: "#10b981" }
    };
    return (_ctx, _push, _parent, _attrs) => {
      var _a, _b;
      _push(`<div${ssrRenderAttrs(mergeProps({
        class: ["activity", { "is-last": __props.isLast }]
      }, _attrs))} data-v-bdcc2778><div class="time-column" data-v-bdcc2778><span class="time" data-v-bdcc2778>${ssrInterpolate(__props.activity.time)}</span><div class="time-line" data-v-bdcc2778></div></div><div class="content-column" data-v-bdcc2778><div class="activity-card" data-v-bdcc2778><div class="activity-header" data-v-bdcc2778><span class="type-badge" style="${ssrRenderStyle({ background: ((_a = typeConfig[__props.activity.type]) == null ? void 0 : _a.color) || "#666" })}" data-v-bdcc2778>${ssrInterpolate(((_b = typeConfig[__props.activity.type]) == null ? void 0 : _b.icon) || "\u{1F4CD}")}</span><strong class="activity-name" data-v-bdcc2778>${ssrInterpolate(__props.activity.name)}</strong><span class="duration" data-v-bdcc2778>${ssrInterpolate(__props.activity.duration)}</span></div>`);
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
        _push(`<div class="weather-bar" data-v-ab39fdaa><div class="weather-main" data-v-ab39fdaa><span class="weather-condition" data-v-ab39fdaa>${ssrInterpolate(__props.day.weather.condition)}</span><span class="weather-temp" data-v-ab39fdaa>${ssrInterpolate(__props.day.weather.temperature.low)}\xB0 ~ ${ssrInterpolate(__props.day.weather.temperature.high)}\xB0 </span></div><div class="weather-suggestion" data-v-ab39fdaa>${ssrInterpolate(__props.day.weather.suggestion)}</div></div>`);
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
        _push(`<div class="hotel-bar" data-v-ab39fdaa><span class="hotel-icon" data-v-ab39fdaa>\u{1F3E8}</span><div class="hotel-info" data-v-ab39fdaa><strong data-v-ab39fdaa>${ssrInterpolate(__props.day.hotel.name)}</strong><span class="hotel-price" data-v-ab39fdaa>\xA5${ssrInterpolate(__props.day.hotel.pricePerNight)}/\u665A</span></div></div>`);
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
      var _a, _b, _c, _d;
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "timeline-panel" }, _attrs))} data-v-8c2e030e><div class="panel-header" data-v-8c2e030e><h3 data-v-8c2e030e><span class="header-icon" data-v-8c2e030e>\u{1F4CB}</span> ${ssrInterpolate((_a = unref(tripStore).plan) == null ? void 0 : _a.city)} ${ssrInterpolate((_b = unref(tripStore).plan) == null ? void 0 : _b.days.length)}\u65E5\u884C\u7A0B </h3></div><div class="day-tabs" data-v-8c2e030e><!--[-->`);
      ssrRenderList((_c = unref(tripStore).plan) == null ? void 0 : _c.days, (day) => {
        var _a2, _b2, _c2, _d2;
        _push(`<button class="${ssrRenderClass(["day-tab", { active: unref(tripStore).activeDay === day.day }])}" data-v-8c2e030e> Day ${ssrInterpolate(day.day)} <span class="day-weather-icon" data-v-8c2e030e>${ssrInterpolate(((_a2 = day.weather) == null ? void 0 : _a2.condition) === "\u6674" ? "\u2600\uFE0F" : ((_b2 = day.weather) == null ? void 0 : _b2.condition) === "\u591A\u4E91" ? "\u26C5" : ((_c2 = day.weather) == null ? void 0 : _c2.condition) === "\u9634" ? "\u2601\uFE0F" : ((_d2 = day.weather) == null ? void 0 : _d2.condition) === "\u5C0F\u96E8" ? "\u{1F327}\uFE0F" : "\u{1F324}\uFE0F")}</span></button>`);
      });
      _push(`<!--]--></div>`);
      if ((_d = unref(tripStore).plan) == null ? void 0 : _d.days) {
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
        _push(`<div class="trip-footer" data-v-8c2e030e><div class="budget-box" data-v-8c2e030e><span class="budget-icon" data-v-8c2e030e>\u{1F4B5}</span><span data-v-8c2e030e>${ssrInterpolate(unref(tripStore).plan.totalBudget)}</span></div>`);
        if (unref(tripStore).plan.tips.length > 0) {
          _push(`<div class="tips-box" data-v-8c2e030e><div class="tips-title" data-v-8c2e030e>\u{1F4A1} \u65C5\u884C\u8D34\u58EB</div><ul data-v-8c2e030e><!--[-->`);
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
      var _a, _b, _c, _d, _e, _f, _g, _h;
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "overlay" }, _attrs))} data-v-92c44cba><div class="loading-card" data-v-92c44cba><div class="loading-icon" data-v-92c44cba>\u{1F916}</div><h3 data-v-92c44cba>AI Agent \u6B63\u5728\u89C4\u5212\u884C\u7A0B</h3><p class="loading-detail" data-v-92c44cba>${ssrInterpolate((_a = unref(tripStore).request) == null ? void 0 : _a.city)} ${ssrInterpolate((_b = unref(tripStore).request) == null ? void 0 : _b.days)}\u65E5\u6E38 `);
      if ((_d = (_c = unref(tripStore).request) == null ? void 0 : _c.preferences) == null ? void 0 : _d.length) {
        _push(`<span data-v-92c44cba> \xB7 ${ssrInterpolate(unref(tripStore).request.preferences.join("\u3001"))}</span>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</p><div class="progress-track" data-v-92c44cba><div class="progress-fill" data-v-92c44cba></div></div>`);
      if (unref(agentStore).steps.length > 0) {
        _push(`<div class="current-step" data-v-92c44cba><span class="step-dot" data-v-92c44cba></span><span class="step-text" data-v-92c44cba>${ssrInterpolate(((_e = unref(agentStore).steps[unref(agentStore).steps.length - 1]) == null ? void 0 : _e.type) === "thought" ? "\u601D\u8003\u4E2D..." : ((_f = unref(agentStore).steps[unref(agentStore).steps.length - 1]) == null ? void 0 : _f.type) === "action" ? `\u6B63\u5728\u8C03\u7528 ${(_g = unref(agentStore).steps[unref(agentStore).steps.length - 1]) == null ? void 0 : _g.tool}...` : ((_h = unref(agentStore).steps[unref(agentStore).steps.length - 1]) == null ? void 0 : _h.type) === "observation" ? "\u5206\u6790\u6570\u636E\u4E2D..." : "\u751F\u6210\u884C\u7A0B\u4E2D...")}</span></div>`);
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
    var _a;
    const dayPlan = (_a = tripStore.plan) == null ? void 0 : _a.days.find((d) => d.day === day);
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
          fallback: "\u5730\u56FE\u52A0\u8F7D\u4E2D..."
        }, {}, _parent));
        _push(`</div><div class="right-panel" data-v-657e0634>`);
        _push(ssrRenderComponent(_component_ThinkingPanel, null, null, _parent));
        _push(ssrRenderComponent(_component_TimelinePanel, null, null, _parent));
        _push(`</div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (!unref(tripStore).plan && !unref(tripStore).loading) {
        _push(`<div class="empty-state" data-v-657e0634><div class="empty-icon" data-v-657e0634>\u{1F5FA}\uFE0F</div><h2 data-v-657e0634>AI \u65C5\u884C\u89C4\u5212 Agent</h2><p data-v-657e0634>\u9009\u62E9\u76EE\u7684\u5730\u4E0E\u504F\u597D\uFF0C\u8BA9 AI \u4E3A\u4F60\u89C4\u5212\u5B8C\u7F8E\u65C5\u7A0B</p><div class="empty-features" data-v-657e0634><div class="feature" data-v-657e0634><span class="feature-icon" data-v-657e0634>\u{1F916}</span><span data-v-657e0634>\u591A\u6B65 ReAct Agent \u5FAA\u73AF</span></div><div class="feature" data-v-657e0634><span class="feature-icon" data-v-657e0634>\u{1F527}</span><span data-v-657e0634>6 \u4E2A\u5DE5\u5177\u81EA\u52A8\u8C03\u7528</span></div><div class="feature" data-v-657e0634><span class="feature-icon" data-v-657e0634>\u{1F4CA}</span><span data-v-657e0634>\u5B9E\u65F6\u601D\u8003\u8FC7\u7A0B\u53EF\u89C6\u5316</span></div></div></div>`);
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

export { index as default };
//# sourceMappingURL=index-BMo6U2r5.mjs.map

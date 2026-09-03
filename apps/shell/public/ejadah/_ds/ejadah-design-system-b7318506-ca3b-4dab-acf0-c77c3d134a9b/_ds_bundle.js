/* @ds-bundle: {"format":4,"namespace":"EjadahDesignSystem_b73185","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"StatusBadge","sourcePath":"components/core/Badge.jsx"},{"name":"StatusPill","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"CardHeader","sourcePath":"components/core/Card.jsx"},{"name":"CardTitle","sourcePath":"components/core/Card.jsx"},{"name":"CardBody","sourcePath":"components/core/Card.jsx"},{"name":"CardFoot","sourcePath":"components/core/Card.jsx"},{"name":"Note","sourcePath":"components/core/Note.jsx"},{"name":"Spinner","sourcePath":"components/core/Note.jsx"},{"name":"Skeleton","sourcePath":"components/core/Note.jsx"},{"name":"StatGrid","sourcePath":"components/data/StatCard.jsx"},{"name":"StatCard","sourcePath":"components/data/StatCard.jsx"},{"name":"KpiBand","sourcePath":"components/data/StatCard.jsx"},{"name":"KpiCell","sourcePath":"components/data/StatCard.jsx"},{"name":"ProgressBar","sourcePath":"components/data/StatCard.jsx"},{"name":"Table","sourcePath":"components/data/Table.jsx"},{"name":"Modal","sourcePath":"components/feedback/Modal.jsx"},{"name":"Toast","sourcePath":"components/feedback/Modal.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/Modal.jsx"},{"name":"InfathField","sourcePath":"components/forms/InfathField.jsx"},{"name":"InfathSection","sourcePath":"components/forms/InfathField.jsx"},{"name":"Label","sourcePath":"components/forms/Input.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Input.jsx"},{"name":"Textarea","sourcePath":"components/forms/Input.jsx"},{"name":"FormField","sourcePath":"components/forms/Input.jsx"},{"name":"FormRow","sourcePath":"components/forms/Input.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"TabBar","sourcePath":"components/navigation/Tabs.jsx"},{"name":"Tab","sourcePath":"components/navigation/Tabs.jsx"},{"name":"ToolbarSearch","sourcePath":"components/navigation/Toolbar.jsx"},{"name":"ToolbarSelect","sourcePath":"components/navigation/Toolbar.jsx"},{"name":"ToolbarPrimaryButton","sourcePath":"components/navigation/Toolbar.jsx"},{"name":"Toolbar","sourcePath":"components/navigation/Toolbar.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"0c73744f55ee","components/core/Button.jsx":"d07b1e5e11ea","components/core/Card.jsx":"96b43c523a2c","components/core/Note.jsx":"a5ca2b50fc26","components/data/StatCard.jsx":"11e145328f6d","components/data/Table.jsx":"b27613e40ee7","components/feedback/Modal.jsx":"c54bc7f342f7","components/forms/InfathField.jsx":"d3369d49a2f7","components/forms/Input.jsx":"3b0219148b87","components/navigation/Tabs.jsx":"1a2d7d713da5","components/navigation/Toolbar.jsx":"4397b1391590","ui_kits/ejadah-app/AppFrame.jsx":"2b80eb5f9a24","ui_kits/ejadah-app/Screens.jsx":"1e053f1c73d3"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.EjadahDesignSystem_b73185 = window.EjadahDesignSystem_b73185 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Badge({
  tone = "default",
  dot = false,
  children,
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    dir: "rtl",
    className: `ej-badge ej-badge--${tone} ${className}`.trim()
  }, props), dot ? /*#__PURE__*/React.createElement("span", {
    className: "ej-badge__dot"
  }) : null, children);
}
const STATUS_MAP = {
  new: ["جديد", "info"],
  progress: ["قيد التنفيذ", "warning"],
  done: ["مكتمل", "success"],
  fail: ["متعذر", "danger"],
  incomplete: ["ناقص", "warning"],
  review: ["قيد المراجعة", "warning"],
  approved: ["معتمد", "success"],
  pending: ["معلّق", "info"],
  under_study: ["قيد الدراسة", "warning"],
  removed: ["محذوف", "danger"]
};
function StatusBadge({
  status
}) {
  const [label, tone] = STATUS_MAP[status] || ["—", "default"];
  return /*#__PURE__*/React.createElement(Badge, {
    tone: tone,
    dot: true
  }, label);
}
function StatusPill({
  label,
  base = "var(--gold)",
  fg = "var(--gold-d)",
  live = false,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("span", {
    dir: "rtl",
    className: `ej-badge ${className}`.trim(),
    style: {
      background: `color-mix(in srgb, ${base} 14%, transparent)`,
      color: fg
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: `ej-status__dot${live ? " ui-status-dot-live" : ""}`,
    style: {
      background: base
    }
  }), label);
}
Object.assign(__ds_scope, { Badge, StatusBadge, StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Button({
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  children,
  className = "",
  ...props
}) {
  const cls = ["ej-btn", `ej-btn--${variant}`, size !== "default" ? `ej-btn--${size}` : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: cls,
    disabled: disabled || loading,
    "aria-busy": loading || undefined
  }, props), loading ? /*#__PURE__*/React.createElement("span", {
    className: "ej-spinner",
    "aria-hidden": "true"
  }) : null, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Card({
  children,
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `ej-card ${className}`.trim()
  }, props), children);
}
function CardHeader({
  children,
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `ej-card__header ${className}`.trim()
  }, props), children);
}
function CardTitle({
  children,
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("h3", _extends({
    className: `ej-card__title ${className}`.trim()
  }, props), children);
}
function CardBody({
  children,
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `ej-card__body ${className}`.trim()
  }, props), children);
}
function CardFoot({
  children,
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `ej-card__foot ${className}`.trim()
  }, props), children);
}
Object.assign(__ds_scope, { Card, CardHeader, CardTitle, CardBody, CardFoot });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Note.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Note({
  tone = "default",
  children,
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `ej-note${tone !== "default" ? ` ej-note--${tone}` : ""} ${className}`.trim()
  }, props), children);
}
function Spinner({
  className = ""
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: `ej-spinner ${className}`.trim(),
    "aria-hidden": "true"
  });
}
function Skeleton({
  style,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `ej-skeleton ui-skeleton-shimmer ${className}`.trim(),
    style: style,
    "aria-hidden": "true"
  });
}
Object.assign(__ds_scope, { Note, Spinner, Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Note.jsx", error: String((e && e.message) || e) }); }

// components/data/StatCard.jsx
try { (() => {
function StatGrid({
  cols = 4,
  children,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `ej-stat-grid ${className}`.trim(),
    style: {
      gridTemplateColumns: `repeat(${cols}, 1fr)`
    }
  }, children);
}
function StatCard({
  accent = "default",
  label,
  value,
  sub,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `ej-stat${accent !== "default" ? ` ej-stat--${accent}` : ""} ${className}`.trim()
  }, /*#__PURE__*/React.createElement("div", {
    className: "ej-stat__label"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "ej-stat__value"
  }, value), sub ? /*#__PURE__*/React.createElement("div", {
    className: "ej-stat__sub"
  }, sub) : null);
}
function KpiBand({
  children,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `ej-kpi ${className}`.trim()
  }, children);
}
function KpiCell({
  first,
  last,
  icon,
  iconStyle,
  label,
  value,
  sub,
  dot
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `ej-kpi__cell${first ? " ej-kpi__cell--first" : ""}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "ej-kpi__head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ej-kpi__icon",
    style: iconStyle
  }, icon), /*#__PURE__*/React.createElement("span", {
    className: "ej-kpi__label"
  }, label)), /*#__PURE__*/React.createElement("div", {
    className: "ej-kpi__value"
  }, /*#__PURE__*/React.createElement("bdi", null, value)), /*#__PURE__*/React.createElement("div", {
    className: "ej-kpi__sub"
  }, dot ? /*#__PURE__*/React.createElement("span", {
    className: "ej-kpi__dot"
  }) : null, sub));
}
function ProgressBar({
  value,
  max = 100,
  tone = "primary",
  className = ""
}) {
  const pct = max > 0 ? Math.round(value / max * 100) : 0;
  return /*#__PURE__*/React.createElement("div", {
    className: `ej-progress ${className}`.trim()
  }, /*#__PURE__*/React.createElement("div", {
    className: `ej-progress__fill${tone !== "primary" ? ` ej-progress__fill--${tone}` : ""}`,
    style: {
      width: `${pct}%`
    }
  }));
}
Object.assign(__ds_scope, { StatGrid, StatCard, KpiBand, KpiCell, ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/data/Table.jsx
try { (() => {
function Table({
  columns = [],
  rows = [],
  hoverable = true,
  renderCell,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ej-table-wrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: `ej-table ${className}`.trim()
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c
  }, c)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((row, ri) => /*#__PURE__*/React.createElement("tr", {
    key: ri,
    className: hoverable ? "ej-tr--hover" : ""
  }, row.map((cell, ci) => /*#__PURE__*/React.createElement("td", {
    key: ci
  }, renderCell ? renderCell(cell, ri, ci) : cell)))))));
}
Object.assign(__ds_scope, { Table });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Table.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Modal.jsx
try { (() => {
function Modal({
  open = true,
  title,
  children,
  footer,
  onClose,
  wide
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "ej-modal-overlay ui-animate-modal-overlay",
    onClick: e => {
      if (e.target === e.currentTarget && onClose) onClose();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: `ej-modal${wide ? " ej-modal--wide" : ""}`,
    role: "dialog",
    "aria-modal": "true"
  }, /*#__PURE__*/React.createElement("header", {
    className: "ej-modal__header"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "ej-modal__close",
    "aria-label": "\u0625\u063A\u0644\u0627\u0642",
    onClick: onClose
  }, "\xD7"), /*#__PURE__*/React.createElement("h2", {
    className: "ej-modal__title"
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 30
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "ej-modal__body"
  }, children), footer ? /*#__PURE__*/React.createElement("footer", {
    className: "ej-modal__footer"
  }, footer) : null));
}
function Toast({
  tone = "success",
  children
}) {
  const icons = {
    success: /*#__PURE__*/React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#8fd0a5",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M20 6 9 17l-5-5"
    })),
    error: /*#__PURE__*/React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "#f0a8a0",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "9"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M15 9 9 15M9 9l6 6"
    })),
    info: /*#__PURE__*/React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "var(--gold-2)",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "9"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 10v6M12 7h.01"
    }))
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "ej-toast ui-animate-toast-in",
    role: "status"
  }, icons[tone] || icons.info, /*#__PURE__*/React.createElement("span", null, children));
}
function EmptyState({
  line,
  hint
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ej-empty"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      color: "var(--text-3)"
    }
  }, line), hint ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "8px 0 0",
      fontSize: 11,
      color: "var(--text-3)"
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { Modal, Toast, EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Modal.jsx", error: String((e && e.message) || e) }); }

// components/forms/InfathField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function InfathField({
  id,
  label,
  required,
  error,
  type = "text",
  options,
  value,
  readOnly,
  ...props
}) {
  const control = options ? /*#__PURE__*/React.createElement("select", _extends({
    id: id,
    className: "ej-infath__control",
    value: value
  }, props), options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o))) : readOnly ? /*#__PURE__*/React.createElement("div", {
    id: id,
    className: "ej-infath__control",
    style: {
      display: "flex",
      alignItems: "center"
    }
  }, value) : /*#__PURE__*/React.createElement("input", _extends({
    id: id,
    type: type,
    className: "ej-infath__control",
    value: value
  }, props));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: `ej-infath${error ? " ej-infath--error" : ""}`
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    className: "ej-infath__label"
  }, label, required ? /*#__PURE__*/React.createElement("b", null, "*") : null), control, options ? /*#__PURE__*/React.createElement("span", {
    style: {
      pointerEvents: "none",
      position: "absolute",
      insetInlineEnd: 12,
      top: "50%",
      transform: "translateY(-50%)",
      color: "#6b7280"
    },
    "aria-hidden": "true"
  }, "\u25BE") : null), error ? /*#__PURE__*/React.createElement("span", {
    className: "ej-field-error"
  }, error) : null);
}
function InfathSection({
  title,
  children
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      margin: "0 0 12px",
      fontSize: 13,
      fontWeight: 700,
      color: "#1f2937"
    }
  }, title), children);
}
Object.assign(__ds_scope, { InfathField, InfathSection });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/InfathField.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Label({
  size = "default",
  children,
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("label", _extends({
    className: `ej-label${size === "field" ? " ej-label--field" : ""} ${className}`.trim()
  }, props), children);
}
function Input({
  hasError,
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("input", _extends({
    className: `ej-field${hasError ? " ej-field--error" : ""} ${className}`.trim()
  }, props));
}
function Select({
  hasError,
  children,
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("select", _extends({
    className: `ej-field${hasError ? " ej-field--error" : ""} ${className}`.trim()
  }, props), children);
}
function Textarea({
  hasError,
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("textarea", _extends({
    className: `ej-field${hasError ? " ej-field--error" : ""} ${className}`.trim()
  }, props));
}
function FormField({
  id,
  label,
  error,
  hint,
  required,
  children,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `${className}`.trim(),
    style: {
      marginBottom: 14
    }
  }, label ? /*#__PURE__*/React.createElement(Label, {
    htmlFor: id,
    size: "field"
  }, label, required ? /*#__PURE__*/React.createElement("span", {
    className: "ej-label__req",
    "aria-hidden": "true"
  }, "*") : null) : null, children, hint && !error ? /*#__PURE__*/React.createElement("p", {
    className: "ej-field-hint"
  }, hint) : null, error ? /*#__PURE__*/React.createElement("p", {
    className: "ej-field-error",
    role: "alert"
  }, error) : null);
}
function FormRow({
  children,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `ej-form-row ${className}`.trim()
  }, children);
}
Object.assign(__ds_scope, { Label, Input, Select, Textarea, FormField, FormRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Tabs({
  items = [],
  active,
  onChange,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `ej-tabbar ${className}`.trim(),
    role: "tablist"
  }, items.map(it => {
    const label = typeof it === "string" ? it : it.label;
    return /*#__PURE__*/React.createElement(Tab, {
      key: label,
      active: active === label,
      count: typeof it === "object" ? it.count : undefined,
      countTone: typeof it === "object" && it.countTone ? it.countTone : "gray",
      onClick: () => onChange && onChange(label)
    }, label);
  }));
}
function TabBar({
  children,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `ej-tabbar ${className}`.trim(),
    role: "tablist"
  }, children);
}
function Tab({
  active,
  count,
  countTone = "gray",
  children,
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    role: "tab",
    "aria-selected": !!active,
    className: `ej-tab${active ? " ej-tab--active" : ""} ${className}`.trim()
  }, props), children, count != null ? /*#__PURE__*/React.createElement("span", {
    className: `ej-tab__count${countTone !== "gray" ? ` ej-tab__count--${countTone}` : ""}`
  }, count) : null);
}
Object.assign(__ds_scope, { Tabs, TabBar, Tab });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Toolbar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SearchGlyph = () => /*#__PURE__*/React.createElement("svg", {
  width: "15",
  height: "15",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.8",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("circle", {
  cx: "11",
  cy: "11",
  r: "8"
}), /*#__PURE__*/React.createElement("path", {
  d: "m21 21-4.3-4.3"
}));
const CaretGlyph = () => /*#__PURE__*/React.createElement("svg", {
  width: "15",
  height: "15",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "m6 9 6 6 6-6"
}));
function ToolbarSearch({
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `ot-search ${className}`.trim()
  }, /*#__PURE__*/React.createElement("span", {
    className: "ot-search__icon"
  }, /*#__PURE__*/React.createElement(SearchGlyph, null)), /*#__PURE__*/React.createElement("input", _extends({
    className: "ot-search__input"
  }, props)));
}
function ToolbarSelect({
  children,
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `ot-sel ${className}`.trim()
  }, /*#__PURE__*/React.createElement("select", _extends({
    className: "ot-sel__control"
  }, props), children), /*#__PURE__*/React.createElement("span", {
    className: "ot-sel__caret"
  }, /*#__PURE__*/React.createElement(CaretGlyph, null)));
}
function ToolbarPrimaryButton({
  children,
  className = "",
  ...props
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: `ot-primary ${className}`.trim()
  }, props), children);
}
function Toolbar({
  children,
  className = ""
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `ej-toolbar ${className}`.trim()
  }, children);
}
Object.assign(__ds_scope, { ToolbarSearch, ToolbarSelect, ToolbarPrimaryButton, Toolbar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Toolbar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/ejadah-app/AppFrame.jsx
try { (() => {
const {
  StatusBadge
} = window.EjadahDesignSystem_b73185;
const NavIcon = ({
  d
}) => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.9",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: d
}));
const ICONS = {
  dash: "M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-18v6h8V3h-8z",
  tx: "M4 6h16M4 12h16M4 18h10",
  po: "M9 12h6M9 16h6M9 8h6M5 4h14v16H5z",
  keys: "M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zM15.5 7.5l3 3L22 7l-3-3",
  fin: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  fail: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  set: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  bell: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  menu: "M4 7h16M4 12h16M4 17h16"
};
function Sidebar({
  page,
  go
}) {
  const items = [{
    grp: "التشغيل",
    rows: [["dashboard", "لوحة التحكم", ICONS.dash], ["queue", "المعاملات النشطة", ICONS.tx, 8], ["po", "أوامر العمل", ICONS.po]]
  }, {
    grp: "المفاتيح والمالية",
    rows: [["keys", "ظروف المفاتيح", ICONS.keys], ["finance", "المالية والفوترة", ICONS.fin], ["failures", "التعذرات", ICONS.fail, 2]]
  }, {
    grp: "عام",
    rows: [["settings", "إعدادات النظام", ICONS.set]]
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "ej-sidebar",
    style: {
      height: "100%"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ej-sidebar__logo"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo-sidebar.svg",
    alt: "\u0625\u062C\u0627\u062F\u0629",
    style: {
      width: 155
    }
  })), /*#__PURE__*/React.createElement("nav", {
    className: "ej-sidebar__nav",
    "aria-label": "\u0627\u0644\u062A\u0646\u0642\u0644 \u0627\u0644\u0631\u0626\u064A\u0633\u064A"
  }, items.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.grp
  }, /*#__PURE__*/React.createElement("div", {
    className: "ej-nav-group"
  }, g.grp), g.rows.map(([id, label, d, badge]) => /*#__PURE__*/React.createElement("button", {
    key: id,
    type: "button",
    className: `ej-nav-item${page === id ? " ej-nav-item--active" : ""}`,
    onClick: () => go(id)
  }, /*#__PURE__*/React.createElement(NavIcon, {
    d: d
  }), /*#__PURE__*/React.createElement("span", null, label), badge ? /*#__PURE__*/React.createElement("span", {
    className: "ej-nav-badge"
  }, badge) : null))))));
}
function Topbar({
  title,
  crumb,
  onLogout
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ej-topbar"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: "var(--heading)",
      lineHeight: 1.3
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--text-3)"
    }
  }, crumb)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "ej-icon-btn",
    "aria-label": "\u0627\u0644\u062A\u0646\u0628\u064A\u0647\u0627\u062A",
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(NavIcon, {
    d: ICONS.bell
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 6,
      insetInlineEnd: 7,
      width: 8,
      height: 8,
      borderRadius: 99,
      background: "var(--danger)",
      border: "2px solid var(--surface)"
    }
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onLogout,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: "transparent",
      border: 0,
      cursor: "pointer",
      padding: "4px 6px",
      borderRadius: 8,
      fontFamily: "inherit"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ej-avatar"
  }, "\u0645\u200C\u0639"), /*#__PURE__*/React.createElement("span", {
    style: {
      textAlign: "start"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: 13,
      fontWeight: 700,
      color: "var(--heading)"
    }
  }, "\u0645\u062D\u0645\u062F \u0627\u0644\u0639\u0645\u0631\u064A"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: 11,
      color: "var(--text-3)"
    }
  }, "\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A"))));
}
Object.assign(window, {
  Sidebar,
  Topbar,
  NavIcon,
  EjIcons: ICONS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/ejadah-app/AppFrame.jsx", error: String((e && e.message) || e) }); }

// ui_kits/ejadah-app/Screens.jsx
try { (() => {
const DS = window.EjadahDesignSystem_b73185;
const {
  Button,
  StatusBadge,
  StatusPill,
  StatGrid,
  StatCard,
  KpiBand,
  KpiCell,
  Table,
  TabBar,
  Tab,
  Toolbar,
  ToolbarSearch,
  ToolbarSelect,
  ToolbarPrimaryButton,
  Note,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  FormField,
  Input,
  Modal
} = DS;
function LoginScreen({
  onLogin
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 380,
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-lg)",
      padding: "36px 32px"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/logo.svg",
    alt: "\u0625\u062C\u0627\u062F\u0629 \u0644\u0644\u062A\u0642\u064A\u064A\u0645",
    style: {
      width: 170,
      display: "block",
      margin: "0 auto 8px"
    }
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: "center",
      fontSize: 12.5,
      color: "var(--text-2)",
      margin: "0 0 24px"
    }
  }, "\u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u062F\u0627\u062E\u0644\u064A \u2014 \u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u062A\u0634\u063A\u064A\u0644\u064A\u0629 \u0648\u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062A"), /*#__PURE__*/React.createElement(FormField, {
    id: "user",
    label: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645"
  }, /*#__PURE__*/React.createElement(Input, {
    id: "user",
    defaultValue: "m.alamri",
    className: "lat"
  })), /*#__PURE__*/React.createElement(FormField, {
    id: "pass",
    label: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631"
  }, /*#__PURE__*/React.createElement(Input, {
    id: "pass",
    type: "password",
    defaultValue: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "ot-primary",
    style: {
      width: "100%",
      marginTop: 8
    },
    onClick: onLogin
  }, "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644"), /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: "center",
      fontSize: 11,
      color: "var(--text-3)",
      margin: "16px 0 0"
    }
  }, "\u0646\u0633\u064A\u062A \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631\u061F \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0646\u0638\u0627\u0645")));
}
const homeIcon = d => /*#__PURE__*/React.createElement("svg", {
  width: "15",
  height: "15",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.8",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: d
}));
function DashboardScreen({
  go
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "ej-canvas"
  }, /*#__PURE__*/React.createElement(KpiBand, {
    style: {
      marginBottom: 0
    }
  }, /*#__PURE__*/React.createElement(KpiCell, {
    first: true,
    icon: homeIcon("M3 21h18M5 21V7l7-4 7 4v14"),
    iconStyle: {
      background: "var(--gold-soft)",
      color: "var(--gold-d)"
    },
    label: "\u0645\u0639\u0627\u0645\u0644\u0627\u062A \u0646\u0634\u0637\u0629",
    value: "24",
    sub: "\u0645\u062D\u062F\u0651\u062B \u0627\u0644\u0622\u0646",
    dot: true
  }), /*#__PURE__*/React.createElement(KpiCell, {
    icon: homeIcon("M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"),
    iconStyle: {
      background: "var(--navy-soft)",
      color: "var(--ink)"
    },
    label: "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F",
    value: "5",
    sub: "\u0623\u0642\u062F\u0645\u0647\u0627 \u0645\u0646\u0630 \u064A\u0648\u0645\u064A\u0646"
  }), /*#__PURE__*/React.createElement(KpiCell, {
    icon: homeIcon("M20 6 9 17l-5-5"),
    iconStyle: {
      background: "var(--navy-soft)",
      color: "var(--ink)"
    },
    label: "\u0645\u0643\u062A\u0645\u0644\u0629 \u0647\u0630\u0627 \u0627\u0644\u0634\u0647\u0631",
    value: "61",
    sub: "+12% \u0639\u0646 \u0627\u0644\u0634\u0647\u0631 \u0627\u0644\u0645\u0627\u0636\u064A"
  }), /*#__PURE__*/React.createElement(KpiCell, {
    last: true,
    icon: homeIcon("M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"),
    iconStyle: {
      background: "var(--danger-bg)",
      color: "var(--red-text)"
    },
    label: "\u0645\u062A\u0639\u0630\u0631\u0629",
    value: "2",
    sub: "\u062A\u062A\u0637\u0644\u0628 \u0625\u062C\u0631\u0627\u0621"
  })), /*#__PURE__*/React.createElement("div", {
    className: "ej-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ej-page-header",
    style: {
      borderRadius: "var(--radius-lg) var(--radius-lg) 0 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    className: "ej-page-header__title"
  }, "\u0623\u062D\u062F\u062B \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062A"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    onClick: () => go("queue")
  }, "\u0639\u0631\u0636 \u0627\u0644\u0643\u0644"))), /*#__PURE__*/React.createElement(Table, {
    columns: ["المرجع", "العميل", "المدينة", "القيمة (ر.س)", "الحالة"],
    rows: [[/*#__PURE__*/React.createElement("bdi", {
      className: "lat num"
    }, "EJ-2026-0412"), "SNB Capital", "الرياض", /*#__PURE__*/React.createElement("span", {
      className: "lat num"
    }, "4,250,000"), /*#__PURE__*/React.createElement(StatusBadge, {
      status: "progress"
    })], [/*#__PURE__*/React.createElement("bdi", {
      className: "lat num"
    }, "EJ-2026-0398"), "بنك الإنماء", "جدة", /*#__PURE__*/React.createElement("span", {
      className: "lat num"
    }, "1,180,000"), /*#__PURE__*/React.createElement(StatusBadge, {
      status: "review"
    })], [/*#__PURE__*/React.createElement("bdi", {
      className: "lat num"
    }, "EJ-2026-0371"), "مصرف الراجحي", "الدمام", /*#__PURE__*/React.createElement("span", {
      className: "lat num"
    }, "2,940,000"), /*#__PURE__*/React.createElement(StatusBadge, {
      status: "done"
    })], [/*#__PURE__*/React.createElement("bdi", {
      className: "lat num"
    }, "EJ-2026-0355"), "بنك البلاد", "الرياض", /*#__PURE__*/React.createElement("span", {
      className: "lat num"
    }, "870,000"), /*#__PURE__*/React.createElement(StatusBadge, {
      status: "fail"
    })]]
  }), /*#__PURE__*/React.createElement("p", {
    className: "ej-table-hint"
  }, "\u0627\u0646\u0642\u0631 \u0639\u0644\u0649 \u0623\u064A \u0635\u0641 \u0644\u0641\u062A\u062D \u0645\u0644\u0641 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "\u0645\u0647\u0627\u0645\u064A \u0627\u0644\u064A\u0648\u0645")), /*#__PURE__*/React.createElement(CardBody, {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u0645\u0639\u0627\u064A\u0646\u0629 \u0623\u0631\u0636 \u2014 \u062D\u064A \u0627\u0644\u0646\u0631\u062C\u0633"), /*#__PURE__*/React.createElement(StatusPill, {
    label: "\u0642\u064A\u062F \u0627\u0644\u062F\u0631\u0627\u0633\u0629",
    base: "var(--gold)",
    fg: "var(--gold-d)",
    live: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u0645\u0631\u0627\u062C\u0639\u0629 \u062A\u0642\u0631\u064A\u0631 ", /*#__PURE__*/React.createElement("bdi", {
    className: "lat num"
  }, "EJ-2026-0398")), /*#__PURE__*/React.createElement(StatusBadge, {
    status: "pending"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u062A\u0633\u0644\u064A\u0645 \u0638\u0631\u0641 \u0645\u0641\u0627\u062A\u064A\u062D \u2014 \u0627\u0644\u0645\u062D\u0643\u0645\u0629 \u0627\u0644\u0639\u0627\u0645\u0629"), /*#__PURE__*/React.createElement(StatusBadge, {
    status: "new"
  })))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, null, /*#__PURE__*/React.createElement(CardTitle, null, "\u062A\u0646\u0628\u064A\u0647\u0627\u062A")), /*#__PURE__*/React.createElement(CardBody, null, /*#__PURE__*/React.createElement(Note, {
    tone: "warn",
    style: {
      marginBottom: 8
    }
  }, "3 \u0645\u0639\u0627\u0645\u0644\u0627\u062A \u062A\u0642\u062A\u0631\u0628 \u0645\u0646 \u0645\u0648\u0639\u062F \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642."), /*#__PURE__*/React.createElement(Note, {
    tone: "info",
    style: {
      marginBottom: 0
    }
  }, "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u062C\u062F\u0648\u0644 \u0623\u062A\u0639\u0627\u0628 \u0627\u0644\u0645\u0643\u0627\u062A\u0628 \u0627\u0644\u0647\u0646\u062F\u0633\u064A\u0629.")))));
}
const QUEUE_ROWS = [["EJ-2026-0412", "SNB Capital", "الرياض", "أرض سكنية", "4,250,000", "progress"], ["EJ-2026-0407", "بنك الجزيرة", "الرياض", "فيلا", "2,100,000", "under_study"], ["EJ-2026-0398", "بنك الإنماء", "جدة", "عمارة تجارية", "1,180,000", "review"], ["EJ-2026-0390", "SNB Capital", "مكة", "أرض تجارية", "6,400,000", "new"], ["EJ-2026-0371", "مصرف الراجحي", "الدمام", "شقة", "2,940,000", "done"], ["EJ-2026-0355", "بنك البلاد", "الرياض", "أرض سكنية", "870,000", "fail"]];
function QueueScreen() {
  const [tab, setTab] = React.useState("الكل");
  const [q, setQ] = React.useState("");
  const [modal, setModal] = React.useState(null);
  const tabFilter = {
    "الكل": () => true,
    "قيد التنفيذ": s => ["progress", "under_study", "new"].includes(s),
    "قيد المراجعة": s => s === "review",
    "متعذرة": s => s === "fail",
    "مكتملة": s => s === "done"
  };
  const rows = QUEUE_ROWS.filter(r => tabFilter[tab](r[5])).filter(r => !q || r[0].includes(q) || r[1].includes(q));
  return /*#__PURE__*/React.createElement("div", {
    className: "ej-canvas"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ej-panel",
    style: {
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement(TabBar, null, Object.keys(tabFilter).map(t => /*#__PURE__*/React.createElement(Tab, {
    key: t,
    active: tab === t,
    count: t === "الكل" ? QUEUE_ROWS.length : QUEUE_ROWS.filter(r => tabFilter[t](r[5])).length,
    countTone: t === "متعذرة" ? "red" : "gray",
    onClick: () => setTab(t)
  }, t))), /*#__PURE__*/React.createElement(Toolbar, null, /*#__PURE__*/React.createElement(ToolbarSearch, {
    placeholder: "\u0627\u0628\u062D\u062B \u0628\u0631\u0642\u0645 \u0627\u0644\u0645\u0631\u062C\u0639 \u0623\u0648 \u0627\u0644\u0639\u0645\u064A\u0644\u2026",
    value: q,
    onChange: e => setQ(e.target.value)
  }), /*#__PURE__*/React.createElement(ToolbarSelect, {
    defaultValue: "all"
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "\u0643\u0644 \u0627\u0644\u0645\u062F\u0646"), /*#__PURE__*/React.createElement("option", null, "\u0627\u0644\u0631\u064A\u0627\u0636"), /*#__PURE__*/React.createElement("option", null, "\u062C\u062F\u0629"), /*#__PURE__*/React.createElement("option", null, "\u0627\u0644\u062F\u0645\u0627\u0645")), /*#__PURE__*/React.createElement(ToolbarPrimaryButton, {
    onClick: () => setModal("new")
  }, "+ \u0645\u0639\u0627\u0645\u0644\u0629 \u062C\u062F\u064A\u062F\u0629")), /*#__PURE__*/React.createElement(Table, {
    columns: ["المرجع", "العميل", "المدينة", "نوع العقار", "القيمة (ر.س)", "الحالة"],
    rows: rows.map(([ref, client, city, type, val, st]) => [/*#__PURE__*/React.createElement("bdi", {
      className: "lat num"
    }, ref), client, city, type, /*#__PURE__*/React.createElement("span", {
      className: "lat num"
    }, val), /*#__PURE__*/React.createElement(StatusBadge, {
      status: st
    })])
  }), rows.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "ej-empty"
  }, "\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u0639\u0627\u0645\u0644\u0627\u062A \u0645\u0637\u0627\u0628\u0642\u0629") : null, /*#__PURE__*/React.createElement("p", {
    className: "ej-table-hint"
  }, "\u0639\u0631\u0636 ", rows.length, " \u0645\u0646 ", QUEUE_ROWS.length, " \u0645\u0639\u0627\u0645\u0644\u0629")), modal ? /*#__PURE__*/React.createElement(Modal, {
    title: "\u0645\u0639\u0627\u0645\u0644\u0629 \u062C\u062F\u064A\u062F\u0629",
    onClose: () => setModal(null),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      onClick: () => setModal(null)
    }, "\u0625\u0644\u063A\u0627\u0621"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: () => setModal(null)
    }, "\u0625\u0646\u0634\u0627\u0621"))
  }, /*#__PURE__*/React.createElement(FormField, {
    id: "nref",
    label: "\u062C\u0647\u0629 \u0627\u0644\u0637\u0644\u0628",
    required: true
  }, /*#__PURE__*/React.createElement(Input, {
    id: "nref",
    placeholder: "\u0627\u0633\u0645 \u0627\u0644\u0628\u0646\u0643 \u0623\u0648 \u0627\u0644\u062C\u0647\u0629"
  })), /*#__PURE__*/React.createElement(FormField, {
    id: "ndeed",
    label: "\u0631\u0642\u0645 \u0627\u0644\u0635\u0643",
    required: true
  }, /*#__PURE__*/React.createElement(Input, {
    id: "ndeed",
    className: "lat num",
    placeholder: "410123456789"
  }))) : null);
}
Object.assign(window, {
  LoginScreen,
  DashboardScreen,
  QueueScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/ejadah-app/Screens.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.StatusBadge = __ds_scope.StatusBadge;

__ds_ns.StatusPill = __ds_scope.StatusPill;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CardHeader = __ds_scope.CardHeader;

__ds_ns.CardTitle = __ds_scope.CardTitle;

__ds_ns.CardBody = __ds_scope.CardBody;

__ds_ns.CardFoot = __ds_scope.CardFoot;

__ds_ns.Note = __ds_scope.Note;

__ds_ns.Spinner = __ds_scope.Spinner;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.StatGrid = __ds_scope.StatGrid;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.KpiBand = __ds_scope.KpiBand;

__ds_ns.KpiCell = __ds_scope.KpiCell;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.Table = __ds_scope.Table;

__ds_ns.Modal = __ds_scope.Modal;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.InfathField = __ds_scope.InfathField;

__ds_ns.InfathSection = __ds_scope.InfathSection;

__ds_ns.Label = __ds_scope.Label;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.FormField = __ds_scope.FormField;

__ds_ns.FormRow = __ds_scope.FormRow;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.TabBar = __ds_scope.TabBar;

__ds_ns.Tab = __ds_scope.Tab;

__ds_ns.ToolbarSearch = __ds_scope.ToolbarSearch;

__ds_ns.ToolbarSelect = __ds_scope.ToolbarSelect;

__ds_ns.ToolbarPrimaryButton = __ds_scope.ToolbarPrimaryButton;

__ds_ns.Toolbar = __ds_scope.Toolbar;

})();

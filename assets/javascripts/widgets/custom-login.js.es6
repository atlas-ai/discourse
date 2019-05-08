import { createWidget } from "discourse/widgets/widget";

export default createWidget("custom-login", {
  tagName: "header.d-header.clearfix",
  buildKey: () => `header`,

  defaultState() {
    return {
      searchVisible: false,
      hamburgerVisible: false,
      userVisible: false,
      ringBackdrop: true,
      skipSearchContext: false
    };
  },

  html(attrs, state) {
    return this.register.lookup("route:application").send("showLogin");
  }
});
import logout from "discourse/lib/logout";

let _showingLogout = false;

//  Subscribe to "logout" change events via the Message Bus
export default {
  name: "logout",
  after: "message-bus",

  initialize: function(container) {
    const messageBus = container.lookup("message-bus:main");

    if (!messageBus) {
      return;
    }

    messageBus.subscribe("/logout", function() {
      logout('https://staging-dixi.atlasaitech.com/landing-page/logout/');
    });
  }
};

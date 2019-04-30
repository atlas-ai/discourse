import { ajax } from "discourse/lib/ajax";
import ModalFunctionality from "discourse/mixins/modal-functionality";
import showModal from "discourse/lib/show-modal";
import { setting } from "discourse/lib/computed";
import { findAll } from "discourse/models/login-method";
import { escape } from "pretty-text/sanitizer";
import { escapeExpression, areCookiesEnabled } from "discourse/lib/utilities";
import { extractError } from "discourse/lib/ajax-error";
import computed from "ember-addons/ember-computed-decorators";
import { SECOND_FACTOR_METHODS } from "discourse/models/user";

// This is happening outside of the app via popup
const AuthErrors = [
  "requires_invite",
  "awaiting_approval",
  "awaiting_activation",
  "admin_not_allowed_from_ip_address",
  "not_allowed_from_ip_address"
];

function generateApiKey(userid, username) {
  const API_KEY = '45196078dc4f95cd3147116a070be24494cd88990847027e56dfb100ed0aa428';
  const API_USERNAME = 'hydrandt1';
  const generate_api_key_url = `/admin/users/${userid}/generate_api_key`;
  const api_username = 'api_username=' + API_USERNAME;
  const api_key = 'api_key=' + API_KEY;
  const baseUrl = 'https://dixi.atlasaitech.com';
  const url = baseUrl + generate_api_key_url + '?' + api_username + '&' + api_key + '&' + `username=${username}`;
  const options = {
    method: 'POST',
  }
  fetch(url, options)
  .then((response) => {
    return response.json();
  })
  .then((jsonResponse) => {
    redirectScoreboard(username, jsonResponse.api_key.key);
  })
  .catch(error => console.error(error));
}

function redirectScoreboard(user, apiKey) {
  window.location.href = `http://localhost:8081/landing-page/${user}/${apiKey}`;
}

function getApiKeyAndUser(login, password) {
  const url = 'http://localhost:8081/api/signin/account/';
  const options = {
    method: 'POST',
    headers: {
        "Content-Type": "application/json",
    },
    body: JSON.stringify({
      "login": login,
      "password": password,
    }),
  };
  fetch(url, options)
  .then((response) => response.json())
  .then((jsonResponse) => {
    if ('errors' in jsonResponse || 'error' in jsonResponse) {
      const errorMessage = jsonResponse.errors || jsonResponse.error;
      return console.warn('login failure:',errorMessage);
    }
    console.log('login success:',jsonResponse.user);
    console.log(jsonResponse);

    redirectScoreboard(jsonResponse.user.username, jsonResponse.api_key.key);
  })
  .catch((error) => console.error(error));
}

export default Ember.Controller.extend(ModalFunctionality, {
  createAccount: Ember.inject.controller(),
  forgotPassword: Ember.inject.controller(),
  application: Ember.inject.controller(),

  authenticate: null,
  loggingIn: false,
  loggedIn: false,
  processingEmailLink: false,
  showLoginButtons: true,
  showSecondFactor: false,
  awaitingApproval: false,

  canLoginLocal: setting("enable_local_logins"),
  canLoginLocalWithEmail: false,
  loginRequired: Ember.computed.alias("application.loginRequired"),
  secondFactorMethod: SECOND_FACTOR_METHODS.TOTP,

  resetForm() {
    this.setProperties({
      authenticate: null,
      loggingIn: false,
      loggedIn: false,
      secondFactorRequired: false,
      showSecondFactor: false,
      showLoginButtons: true,
      awaitingApproval: false
    });
  },

  @computed("showSecondFactor")
  credentialsClass(showSecondFactor) {
    return showSecondFactor ? "hidden" : "";
  },

  @computed("showSecondFactor")
  secondFactorClass(showSecondFactor) {
    return showSecondFactor ? "" : "hidden";
  },

  @computed("awaitingApproval", "hasAtLeastOneLoginButton")
  modalBodyClasses(awaitingApproval, hasAtLeastOneLoginButton) {
    let classes = ["login-modal"];
    if (awaitingApproval) classes.push("awaiting-approval");
    if (hasAtLeastOneLoginButton) classes.push("has-alt-auth");
    return classes.join(" ");
  },

  // Determines whether at least one login button is enabled
  @computed("canLoginLocalWithEmail")
  hasAtLeastOneLoginButton(canLoginLocalWithEmail) {
    return findAll(this.siteSettings).length > 0 || canLoginLocalWithEmail;
  },

  @computed("loggingIn")
  loginButtonLabel(loggingIn) {
    return loggingIn ? "login.logging_in" : "login.title";
  },

  loginDisabled: Ember.computed.or("loggingIn", "loggedIn"),

  @computed("loggingIn", "authenticate", "application.canSignUp")
  showSignupLink(loggingIn, authenticate, canSignUp) {
    return canSignUp && !loggingIn && Ember.isEmpty(authenticate);
  },

  @computed("loggingIn", "authenticate")
  showSpinner(loggingIn, authenticate) {
    return loggingIn || authenticate;
  },

  @computed("canLoginLocalWithEmail", "processingEmailLink")
  showLoginWithEmailLink(canLoginLocalWithEmail, processingEmailLink) {
    return canLoginLocalWithEmail && !processingEmailLink;
  },

  actions: {
    login() {
      const self = this;
      if (this.get("loginDisabled")) {
        return;
      }

      if (
        Ember.isEmpty(this.get("loginName")) ||
        Ember.isEmpty(this.get("loginPassword"))
      ) {
        self.flash(I18n.t("login.blank_username_or_password"), "error");
        return;
      }

      this.set("loggingIn", true);
      const user = this.get('loginName');
      const password = this.get('loginPassword');

      ajax("/session", {
        type: "POST",
        data: {
          login: this.get("loginName"),
          password: this.get("loginPassword"),
          second_factor_token: this.get("secondFactorToken"),
          second_factor_method: this.get("secondFactorMethod")
        }
      }).then(
        function(result) {
          // Successful login
          if (result && result.error) {
            self.set("loggingIn", false);
            if (
              result.reason === "invalid_second_factor" &&
              !self.get("secondFactorRequired")
            ) {
              $("#modal-alert").hide();
              self.setProperties({
                secondFactorRequired: true,
                showLoginButtons: false,
                backupEnabled: result.backup_enabled,
                showSecondFactor: true
              });

              Ember.run.next(() => {
                $("#second-factor input").focus();
              });

              return;
            } else if (result.reason === "not_activated") {
              self.send("showNotActivated", {
                username: self.get("loginName"),
                sentTo: escape(result.sent_to_email),
                currentEmail: escape(result.current_email)
              });
            } else if (result.reason === "suspended") {
              self.send("closeModal");
              bootbox.alert(result.error);
            } else {
              self.flash(result.error, "error");
            }
          } else {
            self.set("loggedIn", true);
            const apiKey = generateApiKey(result.user.id, result.user.username);
            // Trigger the browser's password manager using the hidden static login form:
            const $hidden_login_form = $("#hidden-login-form");
            const destinationUrl = $.cookie("destination_url");
            const ssoDestinationUrl = $.cookie("sso_destination_url");
            $hidden_login_form
              .find("input[name=username]")
              .val(self.get("loginName"));
            $hidden_login_form
              .find("input[name=password]")
              .val(self.get("loginPassword"));

            if (ssoDestinationUrl) {
              $.removeCookie("sso_destination_url");
              window.location.assign(ssoDestinationUrl);
              return;
            } else if (destinationUrl) {
              // redirect client to the original URL
              $.removeCookie("destination_url");
              $hidden_login_form
                .find("input[name=redirect]")
                .val(destinationUrl);
            } else {
              $hidden_login_form
                .find("input[name=redirect]")
                .val(window.location.href);
            }
          }
        },
        function(e) {
          // Failed to login
          if (e.jqXHR && e.jqXHR.status === 429) {
            self.flash(I18n.t("login.rate_limit"), "error");
          } else if (!areCookiesEnabled()) {
            self.flash(I18n.t("login.cookies_error"), "error");
          } else {
            self.flash(I18n.t("login.error"), "error");
          }
          self.set("loggingIn", false);
        }
      );

      return false;
    },

    externalLogin(loginMethod) {
      loginMethod.doLogin();
    },

    createAccount() {
      const createAccountController = this.get("createAccount");
      if (createAccountController) {
        createAccountController.resetForm();
        const loginName = this.get("loginName");
        if (loginName && loginName.indexOf("@") > 0) {
          createAccountController.set("accountEmail", loginName);
        } else {
          createAccountController.set("accountUsername", loginName);
        }
      }
      this.send("showCreateAccount");
    },

    forgotPassword() {
      const forgotPasswordController = this.get("forgotPassword");
      if (forgotPasswordController) {
        forgotPasswordController.set(
          "accountEmailOrUsername",
          this.get("loginName")
        );
      }
      this.send("showForgotPassword");
    },

    emailLogin() {
      if (this.get("processingEmailLink")) {
        return;
      }

      if (Ember.isEmpty(this.get("loginName"))) {
        this.flash(I18n.t("login.blank_username"), "error");
        return;
      }

      this.set("processingEmailLink", true);

      ajax("/u/email-login", {
        data: { login: this.get("loginName").trim() },
        type: "POST"
      })
        .then(data => {
          const loginName = escapeExpression(this.get("loginName"));
          const isEmail = loginName.match(/@/);
          let key = `email_login.complete_${isEmail ? "email" : "username"}`;
          if (data.user_found === false) {
            this.flash(
              I18n.t(`${key}_not_found`, {
                email: loginName,
                username: loginName
              }),
              "error"
            );
          } else {
            this.flash(
              I18n.t(`${key}_found`, { email: loginName, username: loginName })
            );
          }
        })
        .catch(e => {
          this.flash(extractError(e), "error");
        })
        .finally(() => {
          this.set("processingEmailLink", false);
        });
    }
  },

  authMessage: function() {
    if (Ember.isEmpty(this.get("authenticate"))) return "";
    const method = findAll(
      this.siteSettings,
      this.capabilities,
      this.isMobileDevice
    ).findBy("name", this.get("authenticate"));
    if (method) {
      return method.get("message");
    }
  }.property("authenticate"),

  authenticationComplete(options) {
    const self = this;
    function loginError(errorMsg, className, callback) {
      showModal("login");

      Ember.run.next(() => {
        if (callback) callback();
        self.flash(errorMsg, className || "success");
        self.set("authenticate", null);
      });
    }

    if (
      options.awaiting_approval &&
      !this.get("canLoginLocal") &&
      !this.get("canLoginLocalWithEmail")
    ) {
      this.set("awaitingApproval", true);
    }

    if (options.omniauth_disallow_totp) {
      return loginError(I18n.t("login.omniauth_disallow_totp"), "error", () => {
        this.setProperties({
          loginName: options.email,
          showLoginButtons: false
        });

        $("#login-account-password").focus();
      });
    }

    for (let i = 0; i < AuthErrors.length; i++) {
      const cond = AuthErrors[i];
      if (options[cond]) {
        return loginError(I18n.t("login." + cond));
      }
    }

    if (options.suspended) {
      return loginError(options.suspended_message, "error");
    }

    // Reload the page if we're authenticated
    if (options.authenticated) {
      const destinationUrl =
        $.cookie("destination_url") || options.destination_url;
      if (destinationUrl) {
        // redirect client to the original URL
        $.removeCookie("destination_url");
        window.location.href = destinationUrl;
      } else if (window.location.pathname === Discourse.getURL("/login")) {
        window.location.pathname = Discourse.getURL("/");
      } else {
        window.location.reload();
      }
      return;
    }

    const createAccountController = this.get("createAccount");
    createAccountController.setProperties({
      accountEmail: options.email,
      accountUsername: options.username,
      accountName: options.name,
      authOptions: Ember.Object.create(options)
    });
    showModal("createAccount");
  }
});

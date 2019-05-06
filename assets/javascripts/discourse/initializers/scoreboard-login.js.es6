import { withPluginApi } from 'discourse/lib/plugin-api';
import { ajax } from "discourse/lib/ajax";
import { logout } from "discourse/lib/logout";

function signout(username) {
  console.log(`signing out ${username}`);
  const promise = ajax(`/session/${username}`, { type: "DELETE" });
  promise.then(() => {
    logout('http://localhost:8081/landing-page/logout/');
  })
  .catch(error => console.error(error));
}

export default {
  name: 'Atlas-ai changing the world',
  initialize() {
    withPluginApi('0.1', api => {
      const user = api.getCurrentUser();
      if (window.location.search.match(/\?logout/)) return signout(user);
     	api.onPageChange(() => {
     		console.log('user navigated!');
     		if (!user) return;
     		console.log(`current user:${user.name}`);
     		console.log('check if login page');
   		});
    });
  }
}
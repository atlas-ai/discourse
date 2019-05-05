import { withPluginApi } from 'discourse/lib/plugin-api';
import { ajax } from "discourse/lib/ajax";

function logout(username) {
  console.log(`signing out ${username}`);
  return ajax(`/session/${username}`, { type: "DELETE" });
}

export default {
  name: 'Atlas-ai changing the world',
  initialize() {
    withPluginApi('0.1', api => {
      const user = api.getCurrentUser();
      if (window.location.search.match(/\?logout/)) return logout(user);
     	api.onPageChange(() => {
     		console.log('user navigated!');
     		if (!user) return;
     		console.log(`current user:${user.name}`);
     		console.log('check if login page');
   		});
    });
  }
}
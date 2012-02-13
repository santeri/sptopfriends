var sp = getSpotifyApi(1);
var auth = sp.require('sp://import/scripts/api/auth');

exports.init = init;

var accessToken = "";
var friends = [];
var needsAuth = false;

var cache_hit = 0;
var cache_miss = 0;

function graph(path, fn) {
	if (needsAuth === true) return;
	var cache = localStorage.getItem("graphcache" + path);
	if (cache !== null) {
		cache_hit++;
		fn($.parseJSON(cache), 200);
	} else {
		cache_miss++;
	 	
	 	$.getJSON("https://graph.facebook.com/" + path + "?access_token="+accessToken, function(data, status) {
	 		try {
	 			localStorage.setItem("graphcache" + path, JSON.stringify(data));
	 		} catch (e) {
	 			console.log(e);
	 			localStorage.clear();
	 		}
	 		fn(data, status);
	 	}).error(function() { 
			needsAuth = true;
			authfb(); 
		});
	}
	$('#stats #misses').html(cache_miss);
	$('#stats #hits').html(cache_hit);
}

function friend_image(id) {
	return 'https://graph.facebook.com/' + id + '/picture';
}

var friend_musicians = {};
function friend_add_musician(friend_id, musician) {
	if (musician.name !== undefined) {
		if (friend_musicians[friend_id] === undefined) {
			friend_musicians[friend_id] = {};
			friend_musicians[friend_id][musician.name] = 1;
		} else {
			if (friend_musicians[friend_id][musician.name] === undefined) {
				friend_musicians[friend_id][musician.name] = 1;
			} else {
				friend_musicians[friend_id][musician.name]++;
			}
		}
	}							
}

var friend_listens = {};
function find_friend_musicians(friend_id) {
	var listens = friend_listens[friend_id];
	if (listens === undefined) {
		console.log("No listens for friend " + friend_id);
		return;
	}
	$.each(listens, function(_, listen) {
		graph(listen.data.song.id, function(edge, status) {
			if (edge.data.musician === undefined) {
				return;
			}
			$.each(edge.data.musician, function(_, musician) {
				friend_add_musician(friend_id, musician);
			});
			$('#'+friend_id+" ol").empty();
			$.each(friend_musicians[friend_id], function (i, d) {
				$('#'+friend_id+" ol").append("<li>"+d+"&nbsp;"+i+"</li>");
			});
		});
	});

}

function find_friend_listens(friend_id) {
	graph(friend_id + "/music.listens", function (edge, status) {
		if (edge.data.length === 0) {
			$('#'+friend_id).empty();
		} else {
			friend_listens[friend_id] = edge.data;
			find_friend_musicians(friend_id);
		}
	});
}

function populatefriends(friends) {
	$('#friend_container').empty();
	$.each(friends, function(_, friend) {
		$('#friend_container').append('<div id="'+friend.id+'"><img src="'+friend_image(friend.id)+'"/><ol id="listens"></ol></div>');
		$('#friend_container #'+friend.id).click(function() {
			find_friend_musicians(friend.id);
		});
		find_friend_listens(friend.id);
	});
}

function authfb() {
	// XXX: Facebook App ID here 
	auth.authenticateWithFacebook('', 
		['friends_actions.music', 'user_actions.music', 'user_checkins', 'friends_checkins'], {

	onSuccess : function(token, ttl) {
		needsAuth = false;
		console.log("Success! Here's the access token: " + token);
		accessToken = token;
		localStorage.setItem("access_token", token);
		graph("me/music.listens", function (edge, status) {
			if (edge.data.length === 0) {
				$('#me').empty();
			} else {
				$.each(edge.data, function(_, listen) {
					graph(listen.data.song.id, function(edge, status) {
						if (edge.data.musician === undefined) {
							return;
						}
						$.each(edge.data.musician, function(_, musician) {
							friend_add_musician("me", musician);
						});
						$("#me ol").empty();
						$.each(friend_musicians["me"], function (i, d) {
							$('#me ol').append("<li id='"+i+"'>"+d+"&nbsp;"+i+"</li>");
						});
					});
				});
			}
		});

		graph("me/friends", function(data, status) {
			populatefriends(data.data);
	   		$('#auth_btn').hide();
		});
		

	},

	onFailure : function(error) {
		console.log("Authentication failed with error: " + error);
	},

	onComplete : function() { }
});
}

function init() {
	//$('#auth_btn').click(function() {
		authfb();
	//});
	$('#match').click(function() {
		var common = {};
		$.each(friend_musicians, function(friend, musicians) {
			if (friend === "me") { return; }
			$.each(musicians, function(musician, count) {
				$.each(friend_musicians["me"], function(my_musician, my_count) {
					if (musician === my_musician) {
						if (common[musician] === undefined) common[musician] = {};
						common[musician][friend] = 1;
					}
				});
			});
		});
		console.log(common);
		$.each(common, function(artist, friends) {
			$('#common').append("<div>"+artist+"</div>");
			$.each(friends, function(friend, _) {
				$('#common div:last').append('<img src="'+friend_image(friend)+'"></img>');
			});
		});
	});
   $('body').append('<p>loaded</p>');
}

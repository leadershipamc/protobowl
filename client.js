// Generated by CoffeeScript 1.3.3
var actionMode, addAnnotation, avg, changeQuestion, chatAnnotation, createBundle, cumsum, generateName, guessAnnotation, last_question, latency_log, public_name, renderPartial, renderState, renderTimer, serverTime, setActionMode, sock, stdev, sync, sync_offset, sync_offsets, testLatency, time, userSpan, users,
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

sock = io.connect();

sync = {};

users = {};

sync_offsets = [];

sync_offset = 0;

generateName = function() {
  var adjective, animal, pick;
  adjective = 'flaming,aberrant,agressive,warty,hoary,breezy,dapper,edgy,feisty,gutsy,hardy,intrepid,jaunty,karmic,lucid,maverick,natty,oneric,precise,quantal,quizzical,curious,derisive,bodacious,nefarious,nuclear,nonchalant';
  animal = 'monkey,axolotl,warthog,hedgehog,badger,drake,fawn,gibbon,heron,ibex,jackalope,koala,lynx,meerkat,narwhal,ocelot,penguin,quetzal,kodiak,cheetah,puma,jaguar,panther,tiger,leopard,lion,neanderthal,walrus,mushroom,dolphin';
  pick = function(list) {
    var n;
    n = list.split(',');
    return n[Math.floor(n.length * Math.random())];
  };
  return pick(adjective) + " " + pick(animal);
};

public_name = generateName();

$('#username').val(public_name);

$('#username').keydown(function(e) {
  return e.stopPropagation();
});

$('#username').keyup(function() {
  if ($(this).val().length > 0) {
    return sock.emit('rename', $(this).val());
  }
});

avg = function(list) {
  var item, sum, _i, _len;
  sum = 0;
  for (_i = 0, _len = list.length; _i < _len; _i++) {
    item = list[_i];
    sum += item;
  }
  return sum / list.length;
};

stdev = function(list) {
  var item, mu;
  mu = avg(list);
  return Math.sqrt(avg((function() {
    var _i, _len, _results;
    _results = [];
    for (_i = 0, _len = list.length; _i < _len; _i++) {
      item = list[_i];
      _results.push((item - mu) * (item - mu));
    }
    return _results;
  })()));
};

cumsum = function(list, rate) {
  var num, sum, _i, _len, _results;
  sum = 0;
  _results = [];
  for (_i = 0, _len = list.length; _i < _len; _i++) {
    num = list[_i];
    _results.push(sum += Math.round(num) * rate);
  }
  return _results;
};

/*
	So in this application, we have to juggle around not one, not two, but three notions of time
	(and possibly four if you consider freezable time, which needs a cooler name, like what 
	futurama calls intragnizent, so I'll use that, intragnizent time) anyway. So we have three
	notions of time. The first and simplest is server time, which is an uninterruptable number
	of milliseconds recorded by the server's +new Date. Problem is, that the client's +new Date
	isn't exactly the same (can be a few seconds off, not good when we're dealing with precisions
	of tens of milliseconds). However, we can operate off the assumption that the relative duration
	of each increment of time is the same (as in, the relativistic effects due to players in
	moving vehicles at significant fractions of the speed of light are largely unaccounted for
	in this version of the application), and even imprecise quartz clocks only loose a second
	every day or so, which is perfectly okay in the short spans of minutes which need to go 
	unadjusted. So, we can store the round trip and compare the values and calculate a constant
	offset between the client time and the server time. However, for some reason or another, I
	decided to implement the notion of "pausing" the game by stopping the flow of some tertiary
	notion of time (this makes the math relating to calculating the current position of the read
	somewhat easier).

	This is implemented by an offset which is maintained by the server which goes on top of the
	notion of server time. 

	Why not just use the abstraction of that pausable (tragnizent) time everywhere and forget
	about the abstraction of server time, you may ask? Well, there are two reasons, the first
	of which is that two offsets are maintained anyway (the first prototype only used one, 
	and this caused problems on iOS because certain http requests would have extremely long
	latencies when the user was scrolling, skewing the time, this new system allows the system
	to differentiate a pause from a time skew and maintain a more precise notion of time which
	is calculated by a moving window average of previously observed values)

	The second reason, is that there are times when you actually need server time. Situations
	like when you're buzzing and you have a limited time to answer before your window shuts and
	control gets handed back to the group.
*/


time = function() {
  if (sync.time_freeze) {
    return sync.time_freeze;
  } else {
    return serverTime() - sync.time_offset;
  }
};

serverTime = function() {
  return new Date - sync_offset;
};

window.onbeforeunload = function() {
  localStorage.old_socket = sock.socket.sessionid;
  return null;
};

sock.on('echo', function(data, fn) {
  return fn('alive');
});

sock.on('disconnect', function() {
  return setTimeout(function() {
    return $('#disco').modal('show');
  }, 1000);
});

sock.once('connect', function() {
  $('.actionbar button').attr('disabled', false);
  return sock.emit('join', {
    old_socket: localStorage.old_socket,
    room_name: channel_name,
    public_name: public_name
  });
});

sock.on('sync', function(data) {
  var attr, below, item, thresh;
  sync_offsets.push(+(new Date) - data.real_time);
  thresh = avg(sync_offsets);
  below = (function() {
    var _i, _len, _results;
    _results = [];
    for (_i = 0, _len = sync_offsets.length; _i < _len; _i++) {
      item = sync_offsets[_i];
      if (item <= thresh) {
        _results.push(item);
      }
    }
    return _results;
  })();
  sync_offset = avg(below);
  $('#sync_offset').text(sync_offset.toFixed(1) + '/' + stdev(below).toFixed(1));
  console.log('sync', data);
  for (attr in data) {
    sync[attr] = data[attr];
  }
  if ('users' in data) {
    return renderState();
  } else {
    return renderPartial();
  }
});

latency_log = [];

testLatency = function() {
  var initialTime;
  initialTime = +(new Date);
  return sock.emit('echo', {}, function(firstServerTime) {
    var recieveTime;
    recieveTime = +(new Date);
    return sock.emit('echo', {}, function(secondServerTime) {
      var CSC1, CSC2, SCS1, secondTime;
      secondTime = +(new Date);
      CSC1 = recieveTime - initialTime;
      CSC2 = secondTime - recieveTime;
      SCS1 = secondServerTime - firstServerTime;
      latency_log.push(CSC1);
      latency_log.push(SCS1);
      return latency_log.push(CSC2);
    });
  });
};

setTimeout(function() {
  testLatency();
  return setInterval(testLatency, 60 * 1000);
}, 2500);

last_question = null;

sock.on('chat', function(data) {
  return chatAnnotation(data);
});

renderState = function() {
  var action, badge, count, list, row, user, votes, _i, _j, _len, _len1, _ref, _ref1, _ref2;
  if (sync.users) {
    _ref = sync.users;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      user = _ref[_i];
      votes = [];
      for (action in sync.voting) {
        if (_ref1 = user.id, __indexOf.call(sync.voting[action], _ref1) >= 0) {
          votes.push(action);
        }
      }
      user.votes = votes.join(', ');
      users[user.id] = user;
    }
    list = $('.leaderboard tbody');
    count = 0;
    list.find('tr').addClass('to_remove');
    _ref2 = sync.users;
    for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
      user = _ref2[_j];
      $('.user-' + user.id).text(user.name);
      count++;
      row = list.find('.sockid-' + user.id);
      if (row.length < 1) {
        console.log('recreating user');
        row = $('<tr>').appendTo(list);
        row.popover({
          placement: function() {
            if (matchMedia('(max-width: 768px)').matches) {
              return "top";
            } else {
              return "left";
            }
          },
          title: user.name + "'s stats",
          trigger: 'manual',
          content: 'well, they dont exist. sorry. ' + user.id
        });
        row.click(function() {
          $('.leaderboard tbody tr').not(this).popover('hide');
          return $(this).popover('toggle');
        });
      }
      row.find('td').remove();
      row.addClass('sockid-' + user.id);
      row.removeClass('to_remove');
      badge = $('<span>').addClass('badge').text(Math.floor(Math.random() * 1000));
      if (user.id === sock.socket.sessionid) {
        badge.addClass('badge-success');
      }
      $('<td>').text(count).append('&nbsp;').append(badge).appendTo(row);
      $('<td>').text(user.name).appendTo(row);
      $('<td>').text(user.votes || 0).appendTo(row);
    }
    list.find('tr.to_remove').remove();
  }
  return renderPartial();
};

renderPartial = function() {
  var bundle, change, cumulative, index, list, new_text, node, old_text, rate, timeDelta, words, _ref;
  if (!(sync.question && sync.timing)) {
    return;
  }
  if (sync.question !== last_question) {
    changeQuestion();
    last_question = sync.question;
  }
  timeDelta = time() - sync.begin_time;
  words = sync.question.split(' ');
  _ref = sync.timing, list = _ref.list, rate = _ref.rate;
  cumulative = cumsum(list, rate);
  index = 0;
  while (timeDelta > cumulative[index]) {
    index++;
  }
  if (timeDelta > cumulative[0]) {
    index++;
  }
  bundle = $('#history .bundle').first();
  new_text = words.slice(0, index).join(' ');
  old_text = bundle.find('.readout .visible').text();
  if (new_text !== old_text) {
    if (new_text.indexOf(old_text === 0)) {
      node = bundle.find('.readout .visible')[0];
      change = new_text.slice(old_text.length);
      node.appendChild(document.createTextNode(change));
    } else {
      bundle.find('.readout .visible').text(new_text);
    }
    bundle.find('.readout .unread').text(words.slice(index).join(' '));
  }
  renderTimer();
  if (sync.attempt) {
    guessAnnotation(sync.attempt);
  }
  if (latency_log.length > 0) {
    return $('#latency').text(avg(latency_log).toFixed(1) + "/" + stdev(latency_log).toFixed(1));
  }
};

setInterval(renderState, 10000);

setInterval(renderPartial, 50);

renderTimer = function() {
  var cs, elapsed, min, ms, pad, progress, sec, sign;
  if (sync.time_freeze) {
    if (sync.attempt) {
      $('.label.pause').hide();
      $('.label.buzz').fadeIn();
    } else {
      $('.label.pause').fadeIn();
      $('.label.buzz').hide();
    }
    if ($('.pausebtn').text() !== 'Resume') {
      $('.pausebtn').text('Resume').addClass('btn-success').removeClass('btn-warning');
    }
  } else {
    $('.label.pause').fadeOut();
    $('.label.buzz').fadeOut();
    if ($('.pausebtn').text() !== 'Pause') {
      $('.pausebtn').text('Pause').addClass('btn-warning').removeClass('btn-success');
    }
  }
  $('.timer').toggleClass('buzz', !!sync.attempt);
  $('.progress').toggleClass('progress-warning', !!(sync.time_freeze && !sync.attempt));
  $('.progress').toggleClass('progress-danger', !!sync.attempt);
  if (sync.attempt) {
    elapsed = serverTime() - sync.attempt.start;
    ms = sync.attempt.duration - elapsed;
    progress = elapsed / sync.attempt.duration;
    $('.pausebtn, .buzzbtn').attr('disabled', true);
  } else {
    ms = sync.end_time - time();
    progress = (time() - sync.begin_time) / (sync.end_time - sync.begin_time);
    $('.pausebtn, .buzzbtn').attr('disabled', ms < 0);
  }
  if ($('.progress .bar').hasClass('pull-right')) {
    $('.progress .bar').width((1 - progress) * 100 + '%');
  } else {
    $('.progress .bar').width(progress * 100 + '%');
  }
  ms = Math.max(0, ms);
  sign = "";
  if (ms < 0) {
    sign = "+";
  }
  sec = Math.abs(ms) / 1000;
  cs = (sec % 1).toFixed(1).slice(1);
  $('.timer .fraction').text(cs);
  min = sec / 60;
  pad = function(num) {
    var str;
    str = Math.floor(num).toString();
    while (str.length < 2) {
      str = '0' + str;
    }
    return str;
  };
  return $('.timer .face').text(sign + pad(min) + ':' + pad(sec % 60));
};

changeQuestion = function() {
  var bundle, cutoff, old;
  cutoff = 10;
  if (matchMedia('(max-width: 768px)').matches) {
    cutoff = 1;
  }
  $('.bundle').slice(cutoff).slideUp('normal', function() {
    return $(this).remove();
  });
  old = $('#history .bundle').first();
  old.removeClass('active');
  old.find('.breadcrumb').click(function() {
    return 1;
  });
  if (old.find('.readout').length > 0) {
    old.find('.readout')[0].normalize();
  }
  old.find('.readout').slideUp('slow');
  bundle = createBundle().width($('#history').width());
  bundle.addClass('active');
  $('#history').prepend(bundle.hide());
  bundle.slideDown('slow');
  return bundle.width('auto');
};

createBundle = function() {
  var addInfo, annotations, breadcrumb, readout, well;
  breadcrumb = $('<ul>').addClass('breadcrumb');
  addInfo = function(name, value) {
    breadcrumb.find('li').last().append($('<span>').addClass('divider').text('/'));
    return breadcrumb.append($('<li>').text(name + ": " + value));
  };
  addInfo('Category', sync.info.category);
  addInfo('Difficulty', sync.info.difficulty);
  addInfo('Tournament', sync.info.tournament);
  addInfo('Year', sync.info.year);
  breadcrumb.append($('<li>').addClass('answer pull-right').text("Answer: " + sync.answer));
  readout = $('<div>').addClass('readout');
  well = $('<div>').addClass('well').appendTo(readout);
  well.append($('<span>').addClass('visible'));
  well.append(document.createTextNode(' '));
  well.append($('<span>').addClass('unread').text(sync.question));
  annotations = $('<div>').addClass('annotations');
  return $('<div>').addClass('bundle').append(breadcrumb).append(readout).append(annotations);
};

userSpan = function(user) {
  var _ref;
  return $('<span>').addClass('user-' + user).text(((_ref = users[user]) != null ? _ref.name : void 0) || '[name missing]');
};

addAnnotation = function(el) {
  el.css('display', 'none').prependTo($('#history .bundle .annotations').first());
  el.slideDown();
  return el;
};

guessAnnotation = function(_arg) {
  var correct, final, id, line, ruling, session, text, user;
  session = _arg.session, text = _arg.text, user = _arg.user, final = _arg.final, correct = _arg.correct;
  id = user + '-' + session;
  if ($('#' + id).length > 0) {
    line = $('#' + id);
  } else {
    line = $('<p>').attr('id', id);
    line.append($('<span>').addClass('label label-important').text("Buzz"));
    line.append(" ");
    line.append(userSpan(user).addClass('author'));
    line.append(document.createTextNode(' '));
    $('<span>').addClass('comment').appendTo(line);
    ruling = $('<span>').addClass('label ruling').hide();
    line.append(' ');
    line.append(ruling);
    addAnnotation(line);
  }
  if (final) {
    if (text === '') {
      line.find('.comment').html('<em>(blank)</em>');
    } else {
      line.find('.comment').text(text);
    }
  } else {
    line.find('.comment').text(text);
  }
  if (final) {
    ruling = line.find('.ruling').show();
    if (correct) {
      ruling.addClass('label-success').text('Correct');
    } else {
      ruling.addClass('label-warning').text('Wrong');
    }
    if (actionMode === 'guess') {
      return setActionMode('');
    }
  }
};

chatAnnotation = function(_arg) {
  var final, id, line, session, text, user;
  session = _arg.session, text = _arg.text, user = _arg.user, final = _arg.final;
  id = user + '-' + session;
  if ($('#' + id).length > 0) {
    line = $('#' + id);
  } else {
    line = $('<p>').attr('id', id);
    line.append(userSpan(user).addClass('author'));
    line.append(document.createTextNode(' '));
    $('<span>').addClass('comment').appendTo(line);
    addAnnotation(line);
  }
  if (final) {
    if (text === '') {
      line.find('.comment').html('<em>(no message)</em>');
    } else {
      line.find('.comment').text(text);
    }
  } else {
    line.find('.comment').text(text);
  }
  return line.toggleClass('typing', !final);
};

sock.on('introduce', function(_arg) {
  var line, user;
  user = _arg.user;
  line = $('<p>').addClass('log');
  line.append(userSpan(user));
  line.append(" joined the room");
  return addAnnotation(line);
});

sock.on('leave', function(_arg) {
  var line, user;
  user = _arg.user;
  line = $('<p>').addClass('log');
  line.append(userSpan(user));
  line.append(" left the room");
  return addAnnotation(line);
});

jQuery('.bundle .breadcrumb').live('click', function() {
  var readout;
  if (!$(this).is(jQuery('.bundle .breadcrumb').first())) {
    readout = $(this).parent().find('.readout');
    return readout.width($('#history').width()).slideToggle("slow", function() {
      return readout.width('auto');
    });
  }
});

actionMode = '';

setActionMode = function(mode) {
  actionMode = mode;
  $('.guess_input, .chat_input').blur();
  $('.actionbar').toggle(mode === '');
  $('.chat_form').toggle(mode === 'chat');
  $('.guess_form').toggle(mode === 'guess');
  return $(window).resize();
};

$('.chatbtn').click(function() {
  setActionMode('chat');
  return $('.chat_input').data('input_session', Math.random().toString(36).slice(3)).val('').focus();
});

$('.skipbtn').click(function() {
  return sock.emit('skip', 'yay');
});

$('.buzzbtn').click(function() {
  setActionMode('guess');
  $('.guess_input').val('').focus();
  return sock.emit('buzz', 'yay', function(data) {
    if (data !== 'http://www.whosawesome.com/') {
      setActionMode('');
      return console.log('you arent cool enough');
    }
  });
});

$('.pausebtn').click(function() {
  if (!!sync.time_freeze) {
    console.log('unapuse');
    return sock.emit('unpause', 'yay');
  } else {
    return sock.emit('pause', 'yay');
  }
});

$('input').keydown(function(e) {
  return e.stopPropagation();
});

$('.chat_input').keyup(function(e) {
  if (e.keyCode === 13) {
    return;
  }
  return sock.emit('chat', {
    text: $('.chat_input').val(),
    session: $('.chat_input').data('input_session'),
    final: false
  });
});

$('.chat_form').submit(function(e) {
  sock.emit('chat', {
    text: $('.chat_input').val(),
    session: $('.chat_input').data('input_session'),
    final: true
  });
  e.preventDefault();
  return setActionMode('');
});

$('.guess_input').keyup(function(e) {
  if (e.keyCode === 13) {
    return;
  }
  return sock.emit('guess', {
    text: $('.guess_input').val(),
    final: false
  });
});

$('.guess_form').submit(function(e) {
  sock.emit('guess', {
    text: $('.guess_input').val(),
    final: true
  });
  e.preventDefault();
  return setActionMode('');
});

$('body').keydown(function(e) {
  var _ref;
  if (actionMode === 'chat') {
    return $('.chat_input').focus();
  }
  if (actionMode === 'guess') {
    return $('.guess_input').focus();
  }
  if (e.keyCode === 32) {
    e.preventDefault();
    $('.buzzbtn').click();
  } else if (e.keyCode === 83) {
    $('.skipbtn').click();
  } else if (e.keyCode === 80) {
    $('.pausebtn').click();
  } else if ((_ref = e.keyCode) === 47 || _ref === 111 || _ref === 191) {
    console.log("slash");
    e.preventDefault();
    $('.chatbtn').click();
  }
  return console.log(e);
});

$(window).resize(function() {
  return $('.expando').each(function() {
    var add, outer, size;
    add = $(this).find('.add-on').outerWidth();
    size = $(this).width();
    outer = $(this).find('input').outerWidth() - $(this).find('input').width();
    return $(this).find('input').width(size - outer - add);
  });
});

$(window).resize();

if (!Modernizr.touch) {
  $('.actionbar button').tooltip();
  $('.actionbar button').click(function() {
    return $('.actionbar button').tooltip('hide');
  });
}

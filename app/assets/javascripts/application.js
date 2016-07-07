// This is a manifest file that'll be compiled into application.js, which will include all the files
// listed below.
//
// Any JavaScript/Coffee file within this directory, lib/assets/javascripts, vendor/assets/javascripts,
// or any plugin's vendor/assets/javascripts directory can be referenced here using a relative path.
//
// It's not advisable to add code directly here, but if you do, it'll appear at the bottom of the
// compiled file.
//
// Read Sprockets README (https://github.com/rails/sprockets#sprockets-directives) for details
// about supported directives.
//
//= require jquery
//= require jquery_ujs
//= require turbolinks
//= require_tree .


'use strict';

function FriendlyChat() {
  this.messageList = document.getElementById('messages');
  this.userList = document.getElementById('users-card-container');
  this.messageForm = document.getElementById('message-form');
  this.messageInput = document.getElementById('message');
  this.submitButton = document.getElementById('submit');
  this.submitImageButton = document.getElementById('submitImage');
  this.imageForm = document.getElementById('image-form');
  this.mediaCapture = document.getElementById('mediaCapture');
  this.userPic = document.getElementById('user-pic');
  this.userName = document.getElementById('user-name');
  this.signInButton = document.getElementById('sign-in');
  this.signOutButton = document.getElementById('sign-out');
  this.signInSnackbar = document.getElementById('must-signin-snackbar');
  this.messageForm.addEventListener('submit', this.saveMessage.bind(this));
  this.signOutButton.addEventListener('click', this.signOut.bind(this));
  this.signInButton.addEventListener('click', this.signIn.bind(this));
  var buttonTogglingHandler = this.toggleButton.bind(this);
  this.messageInput.addEventListener('keyup', buttonTogglingHandler);
  this.messageInput.addEventListener('change', buttonTogglingHandler);
  this.submitImageButton.addEventListener('click', function() {
    this.mediaCapture.click();
  }.bind(this));
  this.mediaCapture.addEventListener('change', this.saveImageMessage.bind(this));

  this.initFirebase();
}

FriendlyChat.prototype.initFirebase = function() {
  this.auth = firebase.auth();
  this.database = firebase.database();
  this.storage = firebase.storage();
  this.auth.onAuthStateChanged(this.onAuthStateChanged.bind(this));
};

FriendlyChat.prototype.messagesRefTxt = function() {
  var usersInChatIds = []
  if($(".user-card.selected").length > 0){
    usersInChatIds.push(this.auth.currentUser.uid);
    usersInChatIds.push($(".user-card.selected:first").attr("id"));
    return usersInChatIds.sort().join("-");
  }else{
    return ""
  }
};

FriendlyChat.prototype.listenToMessages = function() {
  this.messagesParentRef = this.database.ref('messages');
  this.messagesParentRef.off();
  var setParentMessage = function(data) {
    var val = data.val();
    if(!$("div#"+val.sender_uid).hasClass("selected")){
      $("div#"+val.sender_uid).find("a").click();
    }
  }.bind(this);
  this.messagesParentRef.limitToLast(1).on('child_added', setParentMessage);
  this.messagesParentRef.limitToLast(1).on('child_changed', setParentMessage);
};

FriendlyChat.prototype.loadMessages = function() {
  var messagesRefTxtToConnect = this.messagesRefTxt();
  if(messagesRefTxtToConnect.length > 0){
    this.messagesRef = this.database.ref('messages-'+messagesRefTxtToConnect);
    this.messagesRef.off();
    var setMessage = function(data) {
      var val = data.val();
      this.displayMessage(data.key, val.name, val.text, val.photoUrl, val.imageUrl);
    }.bind(this);
    this.messagesRef.limitToLast(12).on('child_added', setMessage);
    this.messagesRef.limitToLast(12).on('child_changed', setMessage);
  }else{
    var data = {
      message: 'Select online user first to start a chat.',
      timeout: 4000
    };
    this.signInSnackbar.MaterialSnackbar.showSnackbar(data);
  }
};

FriendlyChat.prototype.loadUsers = function() {
  this.usersRef = this.database.ref('users');
  this.usersRef.off();

  var setUser = function(data) {
    var val = data.val();
    if(val.uid != this.auth.currentUser.uid ){
      this.displayUser(val.uid, val.name, val.photoUrl);
    }
  }.bind(this);

  var unsetUser = function(data) {
    var val = data.val();
    $("#" + val.uid).remove();
  }.bind(this);

  this.usersRef.on('child_added', setUser);
  this.usersRef.on('child_changed', setUser);
  this.usersRef.on('child_removed', unsetUser);
};

FriendlyChat.prototype.saveMessage = function(e) {
  e.preventDefault();
  if (this.messageInput.value && this.checkSignedInWithMessage()) {
    if(this.messagesRef){
      var currentUser = this.auth.currentUser;
      this.messagesRef.push({
        name: currentUser.displayName,
        text: this.messageInput.value,
        photoUrl: currentUser.photoURL || '/assets/profile_placeholder.png'
      }).then(function() {
        FriendlyChat.resetMaterialTextfield(this.messageInput);
        this.toggleButton();
      }.bind(this)).catch(function(error) {
        console.error('Error writing new message to Firebase Database', error);
      });
      this.messagesParentRef.push({
        sender_uid: this.auth.currentUser.uid
      });
    }else{
      var data = {
        message: 'Select online user first to start a chat.',
        timeout: 4000
      };
      this.signInSnackbar.MaterialSnackbar.showSnackbar(data);
    }
  }
};

FriendlyChat.prototype.saveUserLogin = function() {
  var currentUser = this.auth.currentUser;
  var userAddedBefore = false;
  var saveUserToFirebase = function() {
    this.usersRef.push({
      name: currentUser.displayName,
      uid: currentUser.uid,
      photoUrl: currentUser.photoURL || '/assets/profile_placeholder.png'
    }).then(function() {
    }.bind(this)).catch(function(error) {
      console.error('Error writing user to Firebase Database', error);
    });
  }.bind(this);

  this.usersRef.once("value", function(snapshot) {
    snapshot.forEach(function(data) {
      var val = data.val();
      if(val.uid == currentUser.uid){
        userAddedBefore = true;
      }
    });
    if(!userAddedBefore){
      saveUserToFirebase();
    }
  });
};

FriendlyChat.prototype.saveUserLogout = function() {
  var currentUser = this.auth.currentUser;
  var saveUserSignoutToFirebase = function(key) {
    var signoutUsersRef = this.database.ref('users/'+key);
    signoutUsersRef.remove();
    this.auth.signOut();
    $("#users-card-container").html("");
  }.bind(this);

  if(this.usersRef){
    this.usersRef.once("value", function(snapshot) {
      snapshot.forEach(function(data) {
        var val = data.val();
        if(val.uid == currentUser.uid){
          saveUserSignoutToFirebase(data.key);
        }
      });
    });
  }
};

FriendlyChat.prototype.setImageUrl = function(imageUri, imgElement) {
  if (imageUri.startsWith('gs://')) {
    imgElement.src = FriendlyChat.LOADING_IMAGE_URL; // Display a loading image first.
    this.storage.refFromURL(imageUri).getMetadata().then(function(metadata) {
      imgElement.src = metadata.downloadURLs[0];
    });
  } else {
    imgElement.src = imageUri;
  }
};

FriendlyChat.prototype.saveImageMessage = function(event) {
  var file = event.target.files[0];

  this.imageForm.reset();

  if (!file.type.match('image.*')) {
    var data = {
      message: 'You can only share images',
      timeout: 4000
    };
    this.signInSnackbar.MaterialSnackbar.showSnackbar(data);
    return;
  }
  if (this.checkSignedInWithMessage()) {
    var currentUser = this.auth.currentUser;
    this.messagesRef.push({
      name: currentUser.displayName,
      imageUrl: FriendlyChat.LOADING_IMAGE_URL,
      photoUrl: currentUser.photoURL || '/assets/profile_placeholder.png'
    }).then(function(data) {

      var uploadTask = this.storage.ref(currentUser.uid + '/' + Date.now() + '/' + file.name)
          .put(file, {'contentType': file.type});
      uploadTask.on('state_changed', null, function(error) {
        console.error('There was an error uploading a file to Firebase Storage:', error);
      }, function() {

        var filePath = uploadTask.snapshot.metadata.fullPath;
        data.update({imageUrl: this.storage.ref(filePath).toString()});
      }.bind(this));
    }.bind(this));
  }
};

FriendlyChat.prototype.signIn = function() {
  var provider = new firebase.auth.GoogleAuthProvider();
  this.auth.signInWithPopup(provider);
};

FriendlyChat.prototype.signOut = function() {
  this.saveUserLogout();
};

FriendlyChat.prototype.onAuthStateChanged = function(user) {
  if (user) {
    var profilePicUrl = user.photoURL;
    var userName = user.displayName;
    this.userPic.style.backgroundImage = 'url(' + profilePicUrl + ')';
    this.userName.textContent = userName;
    this.userName.removeAttribute('hidden');
    this.userPic.removeAttribute('hidden');
    this.signOutButton.removeAttribute('hidden');
    this.signInButton.setAttribute('hidden', 'true');

    this.loadMessages();
    this.listenToMessages();
    this.loadUsers();
    this.saveUserLogin();
  } else {
    this.userName.setAttribute('hidden', 'true');
    this.userPic.setAttribute('hidden', 'true');
    this.signOutButton.setAttribute('hidden', 'true');
    this.signInButton.removeAttribute('hidden');

  }
};

FriendlyChat.prototype.checkSignedInWithMessage = function() {
  if (this.auth.currentUser) {
    return true;
  }

  var data = {
    message: 'You must sign-in first',
    timeout: 4000
  };
  this.signInSnackbar.MaterialSnackbar.showSnackbar(data);
  return false;
};

FriendlyChat.resetMaterialTextfield = function(element) {
  element.value = '';
  element.parentNode.MaterialTextfield.boundUpdateClassesHandler();
};

FriendlyChat.MESSAGE_TEMPLATE =
    '<div class="message-container">' +
      '<div class="spacing"><div class="pic"></div></div>' +
      '<div class="message"></div>' +
      '<div class="name"></div>' +
    '</div>';

FriendlyChat.USER_TEMPLATE =
  '<div class="user-card"><a class="user-card-link" href="#">'+
  '<div class="message-container visible">'+
  '<div class="spacing"><div class="pic"></div></div>'+
  '<div class="username"></div>'+
  '</div></a></div>';

FriendlyChat.LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif';

FriendlyChat.prototype.displayUser = function(uid, name, picUrl) {
  var div = document.getElementById(uid);
  if (!div) {
    var container = document.createElement('div');
    container.innerHTML = FriendlyChat.USER_TEMPLATE;
    div = container.firstChild;
    div.setAttribute('id', uid);
    this.userList.appendChild(div);
  }

  if (picUrl) {
    div.querySelector('.pic').style.backgroundImage = 'url(' + picUrl + ')';
  }

  div.querySelector('.username').textContent = name;
  setTimeout(function() {div.classList.add('visible')}, 1);
  this.userList.scrollTop = this.userList.scrollHeight;
  this.userList.focus();
};

FriendlyChat.prototype.displayMessage = function(key, name, text, picUrl, imageUri) {
  var div = document.getElementById(key);
  if (!div) {
    var container = document.createElement('div');
    container.innerHTML = FriendlyChat.MESSAGE_TEMPLATE;
    div = container.firstChild;
    div.setAttribute('id', key);
    this.messageList.appendChild(div);
  }
  if (picUrl) {
    div.querySelector('.pic').style.backgroundImage = 'url(' + picUrl + ')';
  }
  div.querySelector('.name').textContent = name;
  var messageElement = div.querySelector('.message');
  if (text) {
    messageElement.textContent = text;
    messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
  } else if (imageUri) {
    var image = document.createElement('img');
    image.addEventListener('load', function() {
      this.messageList.scrollTop = this.messageList.scrollHeight;
    }.bind(this));
    this.setImageUrl(imageUri, image);
    messageElement.innerHTML = '';
    messageElement.appendChild(image);
  }
  setTimeout(function() {div.classList.add('visible')}, 1);
  this.messageList.scrollTop = this.messageList.scrollHeight;
  this.messageInput.focus();
};

FriendlyChat.prototype.toggleButton = function() {
  if (this.messageInput.value) {
    this.submitButton.removeAttribute('disabled');
  } else {
    this.submitButton.setAttribute('disabled', 'true');
  }
};

$(document).on("click", "#users-card-container a", function(){
  $("#users-card-container .user-card").removeClass("selected");
  $(this).closest(".user-card").addClass("selected");
  $("#messages").html("");
  window.friendlyChat.loadMessages();
  return false;
});

window.onload = function() {
  window.friendlyChat = new FriendlyChat();
};

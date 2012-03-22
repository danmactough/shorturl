(function(){
function closeMessages() {
  var self = this;
  $(self).fadeOut();
  setTimeout(function() {
    $(self).parent('.alert').hide();
    $(self).remove();
  }, 500);
}

setTimeout(function() {
  $('#messages').each(closeMessages);
}, 5000);

$('#messages').on('click', closeMessages);

function message( type, msg ) {
  var flash = '<div id="messages"><div class="alert-message ' + type + '" data-alert="alert"><a class="close" href="#">&times;</a><p>' + msg + '</p></div></div>';
  $('.alert').empty().append( flash ).show();

  setTimeout(function() {
    $('#messages').each(closeMessages);
  }, 5000);
}

function request( uri, method, data /* optional */, contentType /* optional */, successCallback, errCallback ){
  if (typeof data == 'function') {
    errCallback = contentType;
    successCallback = data;
    contentType = 'application/json';
    data = null;
  } else if (typeof contentType == 'function') {
    errCallback = successCallback;
    successCallback = contentType;
    contentType = 'application/json';
  }
  var req = { url: uri,
              type: method || 'POST' };
  if (data) {
    req.contentType = contentType || 'application/json';
    req.processData = /form-urlencoded/i.test(req.contentType);
    req.data = /json/i.test(req.contentType) ? JSON.stringify(data) : data;
  }
  var jxhr = $.ajax(req)
              .success(successCallback)
              .error(errCallback);
}
$('form#createurl').submit(function(e){
  e.preventDefault();
  var form = $(this)
    , data = $(form).serialize()
    ;

  request($(form).attr('action'), 'POST', data, 'application/x-www-form-urlencoded',
    function(res){
      $(form).find('input#url').val(null);
      $('.alert').empty().hide();
      $('div.results a').attr('href', res.shorturl).html(res.shorturl);
      $('#results-modal').modal();
    },
    function(e, jqxhr, settings, exception){
      var err = '';
      if (e.responseText) {
        err = 'An error occurred trying to shorten that URL. The server said: "' + e.responseText + '"';
      } else {
        err = 'An unknown error occurred trying to shorten that URL.';
      }
      message( 'error', err );
    }
    );
  return false;
});    
$('#logout').click(function(e) {
    e.preventDefault();
    if (confirm('Are you sure you want to log out?')) {
      var element = $(this),
          form = $('<form></form>');
          csrf = $('input[name="_csrf"]');
      form
        .attr({
          method: 'POST',
          action: '/sessions'
        })
        .hide()
        .append('<input type="hidden" name="_method" value="delete"/>')
        .append(csrf)
        .appendTo('body')
        .submit();
    }
  });
})();

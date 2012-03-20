(function(){
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
      $('div.results a').attr('href', res.shorturl).html(res.shorturl);
    },
    function(){
      $('.control-group.results').addClass('success');
    }
    );
  return false;
});    
$('#logout').click(function(e) {
    e.preventDefault();
    if (confirm('Are you sure you want to log out?')) {
      var element = $(this),
          form = $('<form></form>');
      form
        .attr({
          method: 'POST',
          action: '/sessions'
        })
        .hide()
        .append('<input type="hidden" name="_method" value="delete"/>')
        .appendTo('body')
        .submit();
    }
  });
})();

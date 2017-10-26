

function show1(){
  document.getElementById('show-me').style.display ='block';
  document.getElementById('show-button').style.display ='none';
}
function show2(){
  document.getElementById('show-me').style.display = 'none';
  document.getElementById('show-button').style.display ='block';
}

var btnBack = document.getElementById('btnBack');
btnBack.addEventListener('click',function() {
  document.body.classList.toggle('BgClass');
})

$("button").click(function(){
  $(".trigger").toggleClass("drawn")
});

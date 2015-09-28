var zlib = require('zlib');
var http = require('http');
var fs = require('fs');

http.createServer(function(request, response) {
  fs.readFile('result', function(err, data){
    //console.log(data.length);
    console.log(data.toString());
    zlib.unzip(data, function(err, buffer){
      //console.log(buffer.length);
      //console.log(buffer.toString());
      response.write(buffer);
      response.end(); 
    }); 
  });
}).listen(8000);

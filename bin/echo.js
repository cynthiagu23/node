var zlib = require('zlib');
var http = require('http');
var fs = require('fs');

http.createServer(function(request, response) {
  var filePath = request.url;
  //if(filePath == '/admin'){
  fs.readFile('echo', function(err, data){
    //console.log(data.length);
    console.log(request.headers);
    console.log(request.cookies);
    //console.log(data.toString());
    //console.log(buffer.length);
    //console.log(buffer.toString());
    response.write(data);
    response.end(); 
  });
if (request.method == 'POST') {
    console.log("[200] " + request.method + " to " + request.url);
      
    request.on('data', function(chunk) {
      console.log("Received body data:");
      console.log(chunk.toString());
    });
    
    request.on('end', function() {
      // empty 200 OK response for now
      response.writeHead(200, "OK", {'Content-Type': 'text/html'});
      response.end();
    });
    
  }
  //}
}).listen(8000);

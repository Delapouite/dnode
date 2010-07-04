// Client code to Connect to DNode proxies from the web browser
function DNode (obj) {
    if (!(this instanceof DNode)) return new DNode(obj);
    var dnode = this;
    if (obj === undefined) obj = {};
    if (!('methods' in obj)) {
        obj.methods = function () {
            return Object.keys(obj);
        };
    }
    
    function firstType (args, type) {
        return [].concat.apply([],args).filter(function (x) {
            return typeof(x) == type
        })[0];
    }
    
    this.connect = function () {
        var kwargs = firstType(arguments,'object') || {};
        var host = firstType(arguments,'string')
            || kwargs.host || window.location.hostname;
        var port = firstType(arguments,'string')
            || kwargs.port || window.location.port;
        var block = firstType(arguments,'function') || kwargs.block;
        
        var sock = new io.Socket(host, {
            rememberTransport : kwargs.rememberTransport || false,
            transports : kwargs.transports ||
                'websocket htmlfile xhr-multipart xhr-polling'.split(/\s+/),
            port : port,
        });
        
        var reqId = 0;
        var handlers = {};
        var remote = {};
        function request(method, args, f) {
            handlers[reqId] = f;
            sock.send(JSON.stringify({
                method : method,
                arguments : args,
                id : reqId ++,
            }));
        }
        
        sock.addEvent('connect', function () {
            request('methods', [], function (methods) {
                methods.forEach(function (method) {
                    remote[method] = function () {
                        var args = [].concat.apply([],arguments);
                        var argv = args.slice(0,-1);
                        var f = args.slice(-1)[0];
                        request(method,argv,f);
                    };
                });
                block.call(remote, dnode, remote);
            });
        });
        
        sock.addEvent('message', function (strMsg) {
            var msg = JSON.parse(strMsg);
            if ('result' in msg) {
                handlers[msg.id].call(remote,msg.result);
            }
            else if ('method' in msg) {
                var f = obj[msg.method];
                if (f.asynchronous) {
                    var args = msg.arguments + [ function (res) {
                        sock.send(JSON.stringify({
                            id : msg.id,
                            result : res,
                        }));
                    } ];
                    f.apply(obj,args);
                }
                else {
                    var res = f.apply(obj,msg.arguments);
                    sock.send(JSON.stringify({
                        id : msg.id, 
                        result : res,
                    }));
                }
            }
        });
        
        sock.connect();
    };
}

DNode.async = function (f) {
    f.asynchronous = true;
}
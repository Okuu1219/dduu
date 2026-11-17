// 故意不缓存任何东西，永远从网络获取最新代码
self.addEventListener('fetch', function(event) {});
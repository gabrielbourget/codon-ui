#include <dlfcn.h>
#include <cstdio>
#include <cstring>
#include <stdexcept>
#include <exception>
#include <initializer_list>
template<class T> T symbol(void *library, const char *name) {
  dlerror(); void *address = dlsym(library, name); const char *error = dlerror();
  if (error || !address) throw std::runtime_error(error ? error : "missing export");
  return reinterpret_cast<T>(address);
}
int main(int argc, char **argv) {
  if (argc != 3) { std::fprintf(stderr,"usage: independent-controls producer.so consumer.so\n"); return 2; }
  try {
    void *producer = dlopen(argv[1], RTLD_NOW | RTLD_LOCAL);
    if (!producer) throw std::runtime_error(dlerror());
    void *consumer = dlopen(argv[2], RTLD_NOW | RTLD_LOCAL);
    if (!consumer) throw std::runtime_error(dlerror());
    auto create = symbol<void *(*)(int,int *)>(producer,"producer_create");
    auto drop = symbol<void (*)(void *)>(producer,"producer_drop");
    auto pRead = symbol<int (*)(const void *)>(producer,"producer_read");
    auto cRead = symbol<int (*)(const void *)>(consumer,"consumer_read");
    auto retain = symbol<void *(*)(const void *)>(consumer,"consumer_retain");
    auto cDrop = symbol<void (*)(void *)>(consumer,"consumer_drop");
    auto pReader = symbol<const void *(*)()>(producer,"producer_reader")();
    auto cReader = symbol<const void *(*)()>(consumer,"consumer_reader")();
    std::printf("SHARED_READER producer=%p consumer=%p equal=%d\n",pReader,cReader,pReader==cReader);
    if (pReader != cReader) throw std::runtime_error("marker reader implementation is not shared");
    int pControls=symbol<int (*)()>(producer,"producer_controls")();
    int cControls=symbol<int (*)()>(consumer,"consumer_controls")();
    std::printf("LOCAL_CONTROLS producer=%d consumer=%d (owned/foreign/alias/lifetime)\n",pControls,cControls);
    bool mismatch=false;
    for (int authored : {0,1}) {
      int destroyed=0; void *props=create(authored,&destroyed);
      int local=pRead(props), foreign=cRead(props);
      void *alias=retain(props);
      int aliasLocal=pRead(alias),aliasForeign=cRead(alias);
      drop(props);
      bool retained=destroyed==0;
      cDrop(alias);
      bool destroyedOnce=destroyed==1;
      std::printf("CROSS authored=%d producerRead=%d consumerRead=%d aliasProducerRead=%d aliasConsumerRead=%d retained=%d destroyedOnce=%d\n",authored,local,foreign,aliasLocal,aliasForeign,retained,destroyedOnce);
      if (local!=authored || aliasLocal!=authored || !retained || !destroyedOnce) throw std::runtime_error("cross-image control or lifetime failed");
      mismatch=mismatch || foreign!=authored || aliasForeign!=authored;
    }
    std::printf("RESULT %s\n",mismatch?"MARKER_LOOKUP_MISMATCH_REPRODUCED":"MARKER_LOOKUP_PRESERVED");
    dlclose(consumer); dlclose(producer);
    return mismatch?10:0;
  } catch (const std::exception &error) { std::fprintf(stderr,"CONTROL_ERROR %s\n",error.what()); return 2; }
}

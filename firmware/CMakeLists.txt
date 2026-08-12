cmake_minimum_required(VERSION 3.20)
project(miralink_core VERSION 1.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(miralink-core STATIC
  src/miralink_protocol.cpp
  src/miralink_config.cpp
  src/miralink_config_store.cpp
  src/miralink_dualsense.cpp
)
target_include_directories(miralink-core PUBLIC include)
target_compile_options(miralink-core PRIVATE -Wall -Wextra -Wpedantic)

add_executable(miralink-core-tests tests/core_tests.cpp)
target_link_libraries(miralink-core-tests PRIVATE miralink-core)
target_compile_options(miralink-core-tests PRIVATE -Wall -Wextra -Wpedantic)

enable_testing()
add_test(NAME miralink-core-tests COMMAND miralink-core-tests)

cmake_minimum_required(VERSION 3.20)
project(miralink_core VERSION 0.52.0 LANGUAGES CXX)

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

# LLVM-MinGW links the Windows host test dynamically against libc++ and
# libunwind. Keep those runtimes beside the executable so launching the test
# never depends on a shell-specific PATH (and never opens a missing-DLL GUI).
if(WIN32 AND CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  get_filename_component(MIRALINK_LLVM_RUNTIME_DIR "${CMAKE_CXX_COMPILER}" DIRECTORY)
  foreach(MIRALINK_RUNTIME_DLL IN ITEMS libc++.dll libunwind.dll)
    if(EXISTS "${MIRALINK_LLVM_RUNTIME_DIR}/${MIRALINK_RUNTIME_DLL}")
      add_custom_command(TARGET miralink-core-tests POST_BUILD
        COMMAND "${CMAKE_COMMAND}" -E copy_if_different
          "${MIRALINK_LLVM_RUNTIME_DIR}/${MIRALINK_RUNTIME_DLL}"
          "$<TARGET_FILE_DIR:miralink-core-tests>/${MIRALINK_RUNTIME_DLL}"
        VERBATIM)
    endif()
  endforeach()
endif()

enable_testing()
add_test(NAME miralink-core-tests COMMAND miralink-core-tests)

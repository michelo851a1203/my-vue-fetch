<script setup lang="ts">
import { shallowRef, computed } from "vue";
import { usePostsApi } from "@/composables/posts.api";
import { useCustomFetch } from "@/composables/useCustomFetch";

const inputRef = shallowRef<string>("");

const { getPosts, postPosts, getPost, updatePosts, deletePosts } = usePostsApi(useCustomFetch);
const { data: postsList, isFetching: postsListFetching, execute: getPostsRun } = getPosts();
const { data: postItem, isFetching: postItemFetching, execute: getPostItemRun } = getPost("1");

const {
  data: returnPosts,
  isFetching: addPostsFetching,
  execute: postPostsRun
} = postPosts({
  id: "cool",
  title: "foo",
  views: 12
});

const showAllList = async () => {
  await getPostsRun();
};

const addNewPosts = async () => {
  await postPostsRun();
};

const getSinglePost = async () => {
  await getPostItemRun();
};

const deleteExecute = async () => {
  const { execute: deletePostRun } = deletePosts(inputRef);
  await deletePostRun();
};
</script>

<template>
  <button @click="showAllList">test click</button>
  <div v-if="postsListFetching">fetching...</div>
  <div v-else>{{ postsList }}</div>
  <button @click="addNewPosts">add posts</button>
  <div v-if="addPostsFetching">add fetching...</div>
  <div v-else>{{ returnPosts }}</div>

  <button @click="getSinglePost">single test click</button>
  <div v-if="postItemFetching">single fetching...</div>
  <div v-else>{{ postItem }}</div>

  <div>
    <input v-model="inputRef" type="text" />
    <button @click="deleteExecute">Delete</button>
  </div>
</template>

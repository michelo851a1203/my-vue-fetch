import * as zod from "zod";
import { UseCustomFetch } from "@/composables/useCustomFetch";
import { UseFetchReturn } from "@vueuse/core";
import { MaybeRef, toValue } from "vue";

export const postsSchema = zod.object({
  id: zod.string(),
  title: zod.string(),
  views: zod.number()
});

export type PostsSchema = zod.infer<typeof postsSchema>;

export const usePostsApi = (useCustomFetch: UseCustomFetch) => {
  const { useApi } = useCustomFetch();

  const getPosts = (): UseFetchReturn<PostsSchema[]> =>
    useApi({
      responseSchema: postsSchema.array()
    })("/posts")
      .get()
      .json();

  const getPost = (id: string): UseFetchReturn<PostsSchema[]> =>
    useApi({
      responseSchema: postsSchema
    })(`/posts/${id}`)
      .get()
      .json();

  const postPosts = (newPosts: PostsSchema): UseFetchReturn<PostsSchema[]> =>
    useApi({
      responseSchema: postsSchema,
      json: newPosts
    })("/posts")
      .post()
      .json();

  const updatePosts = (id: string, updatePosts: PostsSchema): UseFetchReturn<PostsSchema[]> =>
    useApi({
      responseSchema: postsSchema,
      json: updatePosts
    })(`/posts/${id}`)
      .patch()
      .json();

  const deletePosts = (id: MaybeRef<string>): UseFetchReturn<PostsSchema[]> => {
    //TODO: test
    console.group("%c test", "color: yellow;");
    console.log(toValue(id));
    console.groupEnd();
    return useApi({
      responseSchema: postsSchema
    })(`/posts/${toValue(id)}`)
      .delete()
      .json();
  };

  return {
    getPosts,
    getPost,
    postPosts,
    updatePosts,
    deletePosts
  };
};

export type UsePostsApi = typeof usePostsApi;

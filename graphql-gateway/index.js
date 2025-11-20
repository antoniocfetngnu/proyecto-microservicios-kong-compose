const express = require('express');
const { ApolloServer, gql, ApolloError } = require('apollo-server-express');
const fetch = require('node-fetch');

const USERS_KONG_BASE = 'http://kong:8000';
const USERS_API = `${USERS_KONG_BASE}/api/users`;
const FOLLOWERS_API = `${USERS_KONG_BASE}/api/followers`;
const POSTS_API = `${USERS_KONG_BASE}/api/posts`;
const FEED_API = `${USERS_KONG_BASE}/api/feed`;

const typeDefs = gql`
  scalar Time

  # ========== Users Types ==========
  type User {
    id: ID!
    firstName: String!
    lastName: String!
    email: String!
    username: String!
    createdAt: String
    updatedAt: String
  }

  type Follower {
    id: ID!
    followerId: Int!
    followedId: Int!
    followedSince: String
    follower: User
    followed: User
  }

  # ========== Posts Types ==========
  type Author {
    id: Int!
    username: String!
    first_name: String!
    last_name: String!
  }

  type Media {
    file_url: String!
    filename: String!
    id: ID!
    post_id: String!
    uploaded_at: String!
  }

  type PostInteractions {
    postId: String!
    likesCount: Int!
    commentsCount: Int!
    lastActivityAt: String
  }

  type Comment {
    id: ID!
    postId: String!
    authorId: String!
    text: String!
    likesCount: Int!
    createdAt: String!
    updatedAt: String!
  }

  type Post {
    post_id: ID!
    author_id: Int!
    author: Author!
    description: String!
    media: Media
    media_url: String
    media_type: String
    tags: [String!]!
    engagement_score: Int!
    created_at: String!
    updated_at: String!
    interactions: PostInteractions
    recentComments: [Comment!]
    userLiked: Boolean!
  }

  # ========== Feed Types (NEW) ==========
  type FeedResponse {
    posts: [Post!]!
    nextCursor: String
    hasMore: Boolean!
    total: Int!
  }

  input FeedFilters {
    mediaType: String
    tags: [String!]
  }

  # ========== Queries ==========
  type Query {
    # Users Queries
    users: [User!]!
    user(id: ID!): User
    myFollowers: [Follower!]!
    myFollowing: [Follower!]!

    # Posts Queries
    posts: [Post!]!
    post(postId: ID!): Post
    postsByAuthor(authorId: Int!): [Post!]!
    myPosts: [Post!]!
    hasLikedPost(postId: ID!): Boolean!

    # Feed Queries (NEW)
    """
    Get personalized feed for authenticated user
    Prioritizes posts from followed users
    Requires authentication
    """
    personalizedFeed(
      limit: Int
      cursor: String
      mediaType: String
      tags: [String!]
    ): FeedResponse!

    """
    Get public feed (no authentication required)
    Returns chronological posts from all users
    """
    publicFeed(
      limit: Int
      cursor: String
      mediaType: String
      tags: [String!]
    ): FeedResponse!

    """
    Get trending/popular posts based on engagement
    """
    trendingFeed(
      limit: Int
      cursor: String
      timeWindow: Int
    ): FeedResponse!

    """
    Get discover feed (posts from users you don't follow)
    Requires authentication
    """
    discoverFeed(
      limit: Int
      cursor: String
    ): FeedResponse!
  }
`;

const resolvers = {
  Query: {
    // ========== Users Resolvers ==========
    users: async (_, __, { req }) => {
      const headers = {};
      if (req && req.headers && req.headers.cookie) headers.cookie = req.headers.cookie;

      const res = await fetch(USERS_API, { headers });
      if (!res.ok) {
        if (res.status === 401) throw new ApolloError('Unauthorized (upstream)', 'UNAUTHORIZED');
        throw new ApolloError(`Upstream error: ${res.status}`, 'UPSTREAM_ERROR');
      }
      return res.json();
    },

    user: async (_, { id }, { req }) => {
      const headers = {};
      if (req && req.headers && req.headers.cookie) headers.cookie = req.headers.cookie;

      const url = `${USERS_API}/${id}`;
      const res = await fetch(url, { headers });
      if (res.status === 404) return null;
      if (!res.ok) {
        if (res.status === 401) throw new ApolloError('Unauthorized (upstream)', 'UNAUTHORIZED');
        throw new ApolloError(`Upstream error: ${res.status}`, 'UPSTREAM_ERROR');
      }
      return res.json();
    },

    myFollowers: async (_, __, { req }) => {
      const headers = {};
      if (req && req.headers && req.headers.cookie) headers.cookie = req.headers.cookie;
      else throw new ApolloError('Cookie auth_token not provided', 'UNAUTHORIZED');

      const url = `${FOLLOWERS_API}/my-followers`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        if (res.status === 401) throw new ApolloError('Unauthorized (upstream)', 'UNAUTHORIZED');
        throw new ApolloError(`Upstream error: ${res.status}`, 'UPSTREAM_ERROR');
      }
      return res.json();
    },

    myFollowing: async (_, __, { req }) => {
      const headers = {};
      if (req && req.headers && req.headers.cookie) headers.cookie = req.headers.cookie;
      else throw new ApolloError('Cookie auth_token not provided', 'UNAUTHORIZED');

      const url = `${FOLLOWERS_API}/my-following`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        if (res.status === 401) throw new ApolloError('Unauthorized (upstream)', 'UNAUTHORIZED');
        throw new ApolloError(`Upstream error: ${res.status}`, 'UPSTREAM_ERROR');
      }
      return res.json();
    },

    // ========== Posts Resolvers ==========
    posts: async (_, __, { req }) => {
      const headers = {};
      if (req && req.headers && req.headers.cookie) headers.cookie = req.headers.cookie;

      const res = await fetch(POSTS_API, { headers });
      if (!res.ok) {
        throw new ApolloError(`Error fetching posts: ${res.status}`, 'UPSTREAM_ERROR');
      }
      return res.json();
    },

    post: async (_, { postId }, { req }) => {
      const headers = {};
      if (req && req.headers && req.headers.cookie) headers.cookie = req.headers.cookie;

      const url = `${POSTS_API}/${postId}`;
      const res = await fetch(url, { headers });
      
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new ApolloError(`Error fetching post: ${res.status}`, 'UPSTREAM_ERROR');
      }
      return res.json();
    },

    postsByAuthor: async (_, { authorId }, { req }) => {
      const headers = {};
      if (req && req.headers && req.headers.cookie) headers.cookie = req.headers.cookie;

      const url = `${POSTS_API}/author/${authorId}`;
      const res = await fetch(url, { headers });
      
      if (!res.ok) {
        throw new ApolloError(`Error fetching posts by author: ${res.status}`, 'UPSTREAM_ERROR');
      }
      return res.json();
    },

    myPosts: async (_, __, { req }) => {
      const headers = {};
      if (req && req.headers && req.headers.cookie) {
        headers.cookie = req.headers.cookie;
      } else {
        throw new ApolloError('Authentication required', 'UNAUTHORIZED');
      }

      const url = `${POSTS_API}/my-posts`;
      const res = await fetch(url, { headers });
      
      if (res.status === 401) {
        throw new ApolloError('Unauthorized (upstream)', 'UNAUTHORIZED');
      }
      if (!res.ok) {
        throw new ApolloError(`Error fetching my posts: ${res.status}`, 'UPSTREAM_ERROR');
      }
      return res.json();
    },

    hasLikedPost: async (_, { postId }, { req }) => {
      const headers = {};
      if (req && req.headers && req.headers.cookie) {
        headers.cookie = req.headers.cookie;
      } else {
        throw new ApolloError('Authentication required', 'UNAUTHORIZED');
      }

      const url = `${POSTS_API}/${postId}/like`;
      const res = await fetch(url, { headers });
      
      if (res.status === 401) {
        throw new ApolloError('Unauthorized (upstream)', 'UNAUTHORIZED');
      }
      if (res.status === 404) {
        throw new ApolloError('Post not found', 'NOT_FOUND');
      }
      if (!res.ok) {
        throw new ApolloError(`Error checking like status: ${res.status}`, 'UPSTREAM_ERROR');
      }
      
      const data = await res.json();
      return data.liked;
    },

    // ========== Feed Resolvers (NEW) ==========
    personalizedFeed: async (_, { limit, cursor, mediaType, tags }, { req }) => {
      const headers = {};
      if (req && req.headers && req.headers.cookie) {
        headers.cookie = req.headers.cookie;
      } else {
        throw new ApolloError('Authentication required', 'UNAUTHORIZED');
      }

      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (cursor) params.append('cursor', cursor);
      if (mediaType) params.append('mediaType', mediaType);
      if (tags && tags.length > 0) params.append('tags', tags.join(','));

      const url = `${FEED_API}/personalized?${params.toString()}`;
      const res = await fetch(url, { headers });
      
      if (res.status === 401) {
        throw new ApolloError('Unauthorized (upstream)', 'UNAUTHORIZED');
      }
      if (!res.ok) {
        throw new ApolloError(`Error fetching personalized feed: ${res.status}`, 'UPSTREAM_ERROR');
      }
      return res.json();
    },

    publicFeed: async (_, { limit, cursor, mediaType, tags }, { req }) => {
      const headers = {};
      if (req && req.headers && req.headers.cookie) headers.cookie = req.headers.cookie;

      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (cursor) params.append('cursor', cursor);
      if (mediaType) params.append('mediaType', mediaType);
      if (tags && tags.length > 0) params.append('tags', tags.join(','));

      const url = `${FEED_API}/public?${params.toString()}`;
      const res = await fetch(url, { headers });
      
      if (!res.ok) {
        throw new ApolloError(`Error fetching public feed: ${res.status}`, 'UPSTREAM_ERROR');
      }
      return res.json();
    },

    trendingFeed: async (_, { limit, cursor, timeWindow }, { req }) => {
      const headers = {};
      if (req && req.headers && req.headers.cookie) headers.cookie = req.headers.cookie;

      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (cursor) params.append('cursor', cursor);
      if (timeWindow) params.append('timeWindow', timeWindow.toString());

      const url = `${FEED_API}/trending?${params.toString()}`;
      const res = await fetch(url, { headers });
      
      if (!res.ok) {
        throw new ApolloError(`Error fetching trending feed: ${res.status}`, 'UPSTREAM_ERROR');
      }
      return res.json();
    },

    discoverFeed: async (_, { limit, cursor }, { req }) => {
      const headers = {};
      if (req && req.headers && req.headers.cookie) {
        headers.cookie = req.headers.cookie;
      } else {
        throw new ApolloError('Authentication required', 'UNAUTHORIZED');
      }

      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (cursor) params.append('cursor', cursor);

      const url = `${FEED_API}/discover?${params.toString()}`;
      const res = await fetch(url, { headers });
      
      if (res.status === 401) {
        throw new ApolloError('Unauthorized (upstream)', 'UNAUTHORIZED');
      }
      if (!res.ok) {
        throw new ApolloError(`Error fetching discover feed: ${res.status}`, 'UPSTREAM_ERROR');
      }
      return res.json();
    },
  },
};

async function start() {
  const app = express();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => ({ req }),
    introspection: true,
    playground: true,
  });

  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  const port = process.env.PORT || 4000;
  app.listen(port, () => {
    console.log(`🚀 GraphQL Gateway listening at http://0.0.0.0:${port}${server.graphqlPath}`);
    console.log(`📊 GraphQL Playground: http://localhost:${port}${server.graphqlPath}`);
  });
}

start().catch(err => {
  console.error('Failed to start gateway', err);
  process.exit(1);
});
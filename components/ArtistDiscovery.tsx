"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ExternalLink, Heart, MessageCircle, RefreshCw } from 'lucide-react'

// Sub-tab types
type ArtistDiscoverySubTab = 'artists' | 'scene-dispatch'

interface InstagramPost {
  permalink: string
  author: string
  authorAvatar?: string
  caption: string
  imageUrl: string
  likes: number
  comments: number
  timestamp: string
}

// City selector chip component
function CityChip({ city, selected, onClick }: { city: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
        selected
          ? 'bg-purple-600 text-white shadow-sm'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {city}
    </button>
  )
}

// Instagram post card component
function ScenePostCard({ post }: { post: InstagramPost }) {
  const timeAgo = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardContent className="p-0">
        {/* Author header */}
        <div className="flex items-center gap-3 p-4">
          {post.authorAvatar ? (
            <img
              src={post.authorAvatar}
              alt={post.author}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">@{post.author}</p>
            <p className="text-xs text-gray-500">{timeAgo(post.timestamp)}</p>
          </div>
          <a
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-purple-600 transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>

        {/* Image */}
        <div className="relative aspect-square bg-gray-100">
          <img
            src={post.imageUrl}
            alt="Post content"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Engagement stats */}
        <div className="flex items-center gap-4 p-4 border-b">
          <div className="flex items-center gap-1.5 text-gray-600">
            <Heart className="w-5 h-5" />
            <span className="text-sm font-medium">{post.likes.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600">
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{post.comments.toLocaleString()}</span>
          </div>
        </div>

        {/* Caption */}
        {post.caption && (
          <div className="p-4">
            <p className="text-sm text-gray-700 line-clamp-3">
              <span className="font-semibold">@{post.author}</span> {post.caption}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Scene Dispatch feed component
function SceneDispatchFeed() {
  const cities = ['Miami', 'NYC', 'LA', 'Chicago', 'London', 'Berlin', 'Ibiza', 'Dallas', 'Houston']
  const [selectedCity, setSelectedCity] = useState('Miami')
  const [posts, setPosts] = useState<InstagramPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPosts = async (city: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/supabase/functions/server/scene-dispatch?city=${city.toLowerCase()}`
      )
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch posts')
      }
      const data = await response.json()
      setPosts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPosts(selectedCity)
  }, [selectedCity])

  return (
    <div className="space-y-6">
      {/* City selector */}
      <div className="flex flex-wrap gap-2">
        {cities.map((city) => (
          <CityChip
            key={city}
            city={city}
            selected={selectedCity === city}
            onClick={() => setSelectedCity(city)}
          />
        ))}
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="font-semibold text-red-900">Failed to load feed</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchPosts(selectedCity)}
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-3 p-4">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="aspect-square w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Posts grid */}
      {!loading && !error && posts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post, idx) => (
            <ScenePostCard key={`${post.permalink}-${idx}`} post={post} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && posts.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">No posts found for {selectedCity}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPosts(selectedCity)}
              className="mt-4"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function ArtistDiscovery() {
  const [subTab, setSubTab] = useState<ArtistDiscoverySubTab>('artists')

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Artist Discovery</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Sub-tab switcher */}
          <div className="flex gap-6 border-b mb-6">
            <button
              onClick={() => setSubTab('artists')}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                subTab === 'artists'
                  ? 'text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Artists
              {subTab === 'artists' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
            <button
              onClick={() => setSubTab('scene-dispatch')}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                subTab === 'scene-dispatch'
                  ? 'text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Scene Dispatch
              {subTab === 'scene-dispatch' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
              )}
            </button>
          </div>

          {/* Sub-tab content */}
          {subTab === 'artists' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Artist discovery features coming soon. This will include AI-powered artist matching,
                booking recommendations, and performance analytics.
              </p>
            </div>
          )}

          {subTab === 'scene-dispatch' && <SceneDispatchFeed />}
        </CardContent>
      </Card>
    </div>
  )
}

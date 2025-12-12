import { useState, useCallback, useMemo } from "react"
import { Plus, Check, Trash2, Pencil } from "lucide-react"

import {
  Tags,
  TagsTrigger,
  TagsValue,
  TagsContent,
  TagsInput,
  TagsList,
  TagsEmpty,
  TagsGroup,
  TagsItem,
} from "@/components/ui/shadcn-io/tags"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { useTagsQuery, useCreateTagMutation, useDeleteTagMutation, useUpdateTagMutation } from "../api"
import type { Tag } from "../types"

// 预定义的颜色选项
const TAG_COLORS = [
  { name: "红色", value: "#ef4444" },
  { name: "橙色", value: "#f97316" },
  { name: "黄色", value: "#eab308" },
  { name: "绿色", value: "#22c55e" },
  { name: "青色", value: "#06b6d4" },
  { name: "蓝色", value: "#3b82f6" },
  { name: "紫色", value: "#8b5cf6" },
  { name: "粉色", value: "#ec4899" },
  { name: "灰色", value: "#6b7280" },
]

interface TagSelectorProps {
  selectedTagIds: number[]
  onTagsChange: (tagIds: number[]) => void
  className?: string
}

export function TagSelector({
  selectedTagIds,
  onTagsChange,
  className,
}: TagSelectorProps) {
  const [searchValue, setSearchValue] = useState("")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null)
  const [tagToEdit, setTagToEdit] = useState<Tag | null>(null)
  const [editTagName, setEditTagName] = useState("")
  const [editTagColor, setEditTagColor] = useState<string | undefined>(undefined)

  const { data: allTags = [], isLoading } = useTagsQuery()
  const createTagMutation = useCreateTagMutation()
  const deleteTagMutation = useDeleteTagMutation()
  const updateTagMutation = useUpdateTagMutation()

  // 获取已选中的标签对象
  const selectedTags = useMemo(() => {
    return allTags.filter((tag) => selectedTagIds.includes(tag.id))
  }, [allTags, selectedTagIds])

  // 过滤显示的标签（根据搜索）
  const filteredTags = useMemo(() => {
    if (!searchValue.trim()) return allTags
    const search = searchValue.toLowerCase()
    return allTags.filter((tag) => tag.name.toLowerCase().includes(search))
  }, [allTags, searchValue])

  // 检查搜索值是否是新标签
  const canCreateNew = useMemo(() => {
    if (!searchValue.trim()) return false
    return !allTags.some(
      (tag) => tag.name.toLowerCase() === searchValue.toLowerCase(),
    )
  }, [allTags, searchValue])

  const handleToggleTag = useCallback(
    (tagId: number) => {
      if (selectedTagIds.includes(tagId)) {
        onTagsChange(selectedTagIds.filter((id) => id !== tagId))
      } else {
        onTagsChange([...selectedTagIds, tagId])
      }
    },
    [selectedTagIds, onTagsChange],
  )

  const handleRemoveTag = useCallback(
    (tagId: number) => {
      onTagsChange(selectedTagIds.filter((id) => id !== tagId))
    },
    [selectedTagIds, onTagsChange],
  )

  const handleQuickCreate = useCallback(async () => {
    if (!searchValue.trim() || !canCreateNew) return

    try {
      const newTag = await createTagMutation.mutateAsync({
        name: searchValue.trim(),
      })
      onTagsChange([...selectedTagIds, newTag.id])
      setSearchValue("")
    } catch (error) {
      console.error("Failed to create tag:", error)
    }
  }, [searchValue, canCreateNew, createTagMutation, selectedTagIds, onTagsChange])

  // 删除标签相关
  const handleDeleteTagClick = useCallback(
    (e: React.MouseEvent, tag: Tag) => {
      e.stopPropagation()
      e.preventDefault()
      setTagToDelete(tag)
      setIsDeleteDialogOpen(true)
    },
    [],
  )

  const handleConfirmDelete = useCallback(async () => {
    if (!tagToDelete) return

    try {
      await deleteTagMutation.mutateAsync(tagToDelete.id)
      // 如果删除的标签在当前选中列表中，也移除它
      if (selectedTagIds.includes(tagToDelete.id)) {
        onTagsChange(selectedTagIds.filter((id) => id !== tagToDelete.id))
      }
      setIsDeleteDialogOpen(false)
      setTagToDelete(null)
    } catch (error) {
      console.error("Failed to delete tag:", error)
    }
  }, [tagToDelete, deleteTagMutation, selectedTagIds, onTagsChange])

  const handleCancelDelete = useCallback(() => {
    setIsDeleteDialogOpen(false)
    setTagToDelete(null)
  }, [])

  // 编辑标签相关
  const handleEditTagClick = useCallback(
    (e: React.MouseEvent, tag: Tag) => {
      e.stopPropagation()
      e.preventDefault()
      setTagToEdit(tag)
      setEditTagName(tag.name)
      setEditTagColor(tag.color ?? undefined)
      setIsEditDialogOpen(true)
    },
    [],
  )

  const handleConfirmEdit = useCallback(async () => {
    if (!tagToEdit || !editTagName.trim()) return

    try {
      await updateTagMutation.mutateAsync({
        id: tagToEdit.id,
        name: editTagName.trim(),
        color: editTagColor ?? null,
      })
      setIsEditDialogOpen(false)
      setTagToEdit(null)
      setEditTagName("")
      setEditTagColor(undefined)
    } catch (error) {
      console.error("Failed to update tag:", error)
    }
  }, [tagToEdit, editTagName, editTagColor, updateTagMutation])

  const handleCancelEdit = useCallback(() => {
    setIsEditDialogOpen(false)
    setTagToEdit(null)
    setEditTagName("")
    setEditTagColor(undefined)
  }, [])

  return (
    <>
      <Tags className={className}>
        <TagsTrigger>
          {selectedTags.map((tag) => (
            <TagsValue
              key={tag.id}
              onRemove={() => handleRemoveTag(tag.id)}
              style={{
                backgroundColor: tag.color || undefined,
                borderColor: tag.color || undefined,
              }}
            >
              {tag.name}
            </TagsValue>
          ))}
        </TagsTrigger>
        <TagsContent>
          <TagsInput
            placeholder="搜索标签..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <TagsList>
            {isLoading ? (
              <div className="p-2 text-center text-sm text-muted-foreground">
                加载中...
              </div>
            ) : filteredTags.length === 0 && !canCreateNew ? (
              <TagsEmpty>没有找到标签</TagsEmpty>
            ) : (
              <>
                <TagsGroup>
                  {filteredTags.map((tag) => (
                    <TagsItem
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => handleToggleTag(tag.id)}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{
                            backgroundColor: tag.color || "#6b7280",
                          }}
                        />
                        <span className="flex-1">{tag.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {selectedTagIds.includes(tag.id) && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          onClick={(e) => handleEditTagClick(e, tag)}
                          title="编辑标签"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                          onClick={(e) => handleDeleteTagClick(e, tag)}
                          title="删除标签"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </TagsItem>
                  ))}
                </TagsGroup>
                {canCreateNew && (
                  <TagsGroup>
                    <TagsItem
                      value={`create-${searchValue}`}
                      onSelect={handleQuickCreate}
                      className="text-primary"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        <span>创建 "{searchValue}"</span>
                      </div>
                    </TagsItem>
                  </TagsGroup>
                )}
              </>
            )}
          </TagsList>
        </TagsContent>
      </Tags>

      {/* 编辑标签对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => !open && handleCancelEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑标签</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-tag-name">标签名称</Label>
              <Input
                id="edit-tag-name"
                value={editTagName}
                onChange={(e) => setEditTagName(e.target.value)}
                placeholder="输入标签名称"
              />
            </div>
            <div className="space-y-2">
              <Label>标签颜色</Label>
              <div className="flex flex-wrap gap-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`h-8 w-8 rounded-full transition-transform ${
                      editTagColor === color.value
                        ? "ring-2 ring-primary ring-offset-2 scale-110"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setEditTagColor(color.value)}
                    title={color.name}
                  />
                ))}
                <button
                  type="button"
                  className={`h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground transition-transform ${
                    editTagColor === undefined
                      ? "ring-2 ring-primary ring-offset-2 scale-110"
                      : "hover:scale-110"
                  }`}
                  onClick={() => setEditTagColor(undefined)}
                  title="无颜色"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit}>
              取消
            </Button>
            <Button
              onClick={handleConfirmEdit}
              disabled={!editTagName.trim() || updateTagMutation.isPending}
            >
              {updateTagMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除标签确认对话框 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除标签</DialogTitle>
            <DialogDescription>
              确定要删除标签 "{tagToDelete?.name}" 吗？
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              此操作将：
            </p>
            <ul className="mt-2 list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>永久删除该标签</li>
              <li>移除所有任务与此标签的关联</li>
              <li>移除所有番茄钟会话与此标签的关联</li>
              <li>更新任务详情中的标签字段</li>
            </ul>
            <p className="mt-3 text-sm font-medium text-destructive">
              此操作不可撤销！
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDelete}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteTagMutation.isPending}
            >
              {deleteTagMutation.isPending ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// 辅助组件：显示标签列表（只读）
interface TagListProps {
  tags: Tag[]
  className?: string
}

export function TagList({ tags, className }: TagListProps) {
  if (tags.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1 ${className || ""}`}>
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: tag.color ? `${tag.color}20` : "#6b728020",
            color: tag.color || "#6b7280",
            border: `1px solid ${tag.color || "#6b7280"}40`,
          }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  )
}

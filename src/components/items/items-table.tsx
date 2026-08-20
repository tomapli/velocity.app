"use client";

import { useState } from "react";
import { ListPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/responsive-alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ITEM_TITLE_MAX_LENGTH } from "@/lib/items/constants";
import { createItem, deleteItem, type Item } from "@/lib/items/queries";
import { useItemsRealtime } from "@/lib/items/use-items-realtime";
import { createClient } from "@/lib/supabase/client";

interface ItemsTableProps {
  initialItems: Item[];
  userId: string;
}

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Live items list. Mutations go through PostgREST; other clients update via
 * Realtime broadcast from a database trigger.
 */
export function ItemsTable({ initialItems, userId }: ItemsTableProps) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const upsertItem = (item: Item) => {
    setItems((current) => {
      const without = current.filter((row) => row.id !== item.id);
      return [item, ...without].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );
    });
  };

  useItemsRealtime({
    onInsert: upsertItem,
    onUpdate: upsertItem,
    onDelete: (item) => {
      setItems((current) => current.filter((row) => row.id !== item.id));
    },
  });

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      const created = await createItem(supabase, {
        title: trimmed,
        createdBy: userId,
      });
      upsertItem(created);
      setTitle("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const supabase = createClient();

    try {
      await deleteItem(supabase, id);
      setItems((current) => current.filter((row) => row.id !== id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete item");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add an item"
          maxLength={ITEM_TITLE_MAX_LENGTH}
          aria-label="Item title"
          required
        />
        <Button type="submit" disabled={isSubmitting || title.trim().length === 0}>
          Add
        </Button>
      </form>

      {items.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListPlus />
            </EmptyMedia>
            <EmptyTitle>No items yet</EmptyTitle>
            <EmptyDescription>
              Add one above. Everyone who is signed in can see it live.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead className="hidden sm:table-cell">Created</TableHead>
              <TableHead className="w-16">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.title}</TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {item.created_at
                    ? DATE_FORMATTER.format(new Date(item.created_at))
                    : "—"}
                </TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${item.title}`}
                        disabled={deletingId === item.id}
                      >
                        <Trash2 />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this item?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Anyone who is signed in can delete items. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Edit, Trash2, FileText, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ContentBlock {
  id: string;
  key: string;
  value: string;
  type: string;
  description: string | null;
  updated_at: string;
}

const ContentBlocksManager = () => {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ContentBlock | null>(null);
  const [formData, setFormData] = useState({
    key: '',
    value: '',
    type: 'text',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [blockToDelete, setBlockToDelete] = useState<ContentBlock | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchBlocks();
  }, []);

  const fetchBlocks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('content_blocks')
        .select('*')
        .order('key');

      if (error) throw error;
      setBlocks(data || []);
    } catch (error) {
      console.error('Error fetching content blocks:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch content blocks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const logAction = async (actionType: string, targetId: string, metadata: Record<string, unknown>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      await supabase.from('action_logs').insert([{
        actor_id: user.id,
        action_type: actionType,
        target_table: 'content_blocks',
        target_id: targetId,
        metadata: metadata as any,
      }]);
    } catch (error) {
      console.error('Error logging action:', error);
    }
  };

  const handleOpenCreate = () => {
    setEditingBlock(null);
    setFormData({ key: '', value: '', type: 'text', description: '' });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (block: ContentBlock) => {
    setEditingBlock(block);
    setFormData({
      key: block.key,
      value: block.value,
      type: block.type,
      description: block.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.key.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Key is required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (editingBlock) {
        // Update existing
        const { error } = await supabase
          .from('content_blocks')
          .update({
            value: formData.value,
            type: formData.type,
            description: formData.description || null,
            updated_by: user?.id,
          })
          .eq('id', editingBlock.id);

        if (error) throw error;

        await logAction('update_content_block', editingBlock.id, {
          key: editingBlock.key,
          old_value: editingBlock.value,
          new_value: formData.value,
        });

        toast({ title: 'Content Updated', description: `"${formData.key}" has been updated` });
      } else {
        // Create new
        const { data, error } = await supabase
          .from('content_blocks')
          .insert({
            key: formData.key.toLowerCase().replace(/\s+/g, '_'),
            value: formData.value,
            type: formData.type,
            description: formData.description || null,
            updated_by: user?.id,
          })
          .select()
          .single();

        if (error) throw error;

        await logAction('create_content_block', data.id, { key: formData.key });

        toast({ title: 'Content Created', description: `"${formData.key}" has been created` });
      }

      setIsDialogOpen(false);
      fetchBlocks();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save content block',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!blockToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('content_blocks')
        .delete()
        .eq('id', blockToDelete.id);

      if (error) throw error;

      await logAction('delete_content_block', blockToDelete.id, { key: blockToDelete.key });

      toast({ title: 'Content Deleted', description: `"${blockToDelete.key}" has been deleted` });
      setDeleteConfirmOpen(false);
      setBlockToDelete(null);
      fetchBlocks();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete content block',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      text: 'bg-blue-500/10 text-blue-500',
      rich_text: 'bg-purple-500/10 text-purple-500',
      markdown: 'bg-green-500/10 text-green-500',
      html: 'bg-orange-500/10 text-orange-500',
      json: 'bg-yellow-500/10 text-yellow-500',
    };
    return <Badge className={colors[type] || 'bg-muted'}>{type}</Badge>;
  };

  const filteredBlocks = blocks.filter(block =>
    block.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    block.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Content Blocks (CMS)
              </CardTitle>
              <CardDescription>Manage all website content without code changes</CardDescription>
            </div>
            <Button onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Add Content
            </Button>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by key or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Value Preview</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBlocks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No content blocks found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBlocks.map((block) => (
                    <TableRow key={block.id}>
                      <TableCell className="font-mono text-sm">{block.key}</TableCell>
                      <TableCell>{getTypeBadge(block.type)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {block.description || '-'}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {block.value.substring(0, 50)}{block.value.length > 50 ? '...' : ''}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleOpenEdit(block)}>
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setBlockToDelete(block);
                              setDeleteConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingBlock ? 'Edit Content Block' : 'Create Content Block'}</DialogTitle>
            <DialogDescription>
              {editingBlock ? 'Update the content for this block' : 'Add a new content block to the CMS'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Key (Identifier)</Label>
              <Input
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                placeholder="e.g., home_hero_title"
                disabled={!!editingBlock}
              />
              <p className="text-xs text-muted-foreground">Unique identifier used in code</p>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="rich_text">Rich Text</SelectItem>
                  <SelectItem value="markdown">Markdown</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of where this content appears"
              />
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Textarea
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="Enter the content..."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingBlock ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Content Block</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{blockToDelete?.key}"? This may break parts of the website that depend on this content.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ContentBlocksManager;

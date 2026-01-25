import { useState, useEffect, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Building2,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Organization {
  id: string;
  name: string;
  orgCode: string;
  slug: string;
  isActive: boolean;
  isRoot: boolean;
  depth: number;
  path?: string;
  canHaveChildren: boolean;
  parentOrganizationId?: string;
  rootOrganizationId?: string;
}

interface HierarchyNode extends Organization {
  children?: HierarchyNode[];
  childCount?: number;
}

interface OrganizationHierarchyTabProps {
  organization: Organization;
}

export function OrganizationHierarchyTab({ organization }: OrganizationHierarchyTabProps) {
  const [hierarchyData, setHierarchyData] = useState<HierarchyNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const fetchHierarchy = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch the hierarchy tree
      const rootId = organization.rootOrganizationId || organization.id;
      const response = await apiClient.get<{ data: Organization[] }>(
        `/organizations/${rootId}/hierarchy`
      );

      // Build tree structure from flat list
      const tree = buildTree(response.data || []);
      setHierarchyData(tree);

      // Auto-expand current organization and its ancestors
      const pathParts = organization.path?.split('.') || [];
      const toExpand = new Set<string>();
      for (const org of response.data || []) {
        if (pathParts.some((part) => org.path?.includes(part))) {
          toExpand.add(org.id);
        }
      }
      setExpandedNodes(toExpand);
    } catch (err) {
      console.error('Failed to fetch hierarchy:', err);
      setError('Failed to load organization hierarchy');
    } finally {
      setIsLoading(false);
    }
  }, [organization.id, organization.rootOrganizationId, organization.path]);

  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);

  const buildTree = (orgs: Organization[]): HierarchyNode[] => {
    const map = new Map<string, HierarchyNode>();
    const roots: HierarchyNode[] = [];

    // First pass: create nodes
    for (const org of orgs) {
      map.set(org.id, { ...org, children: [] });
    }

    // Second pass: build tree
    for (const org of orgs) {
      const node = map.get(org.id)!;
      if (org.parentOrganizationId && map.has(org.parentOrganizationId)) {
        const parent = map.get(org.parentOrganizationId)!;
        parent.children = parent.children || [];
        parent.children.push(node);
      } else if (org.isRoot) {
        roots.push(node);
      }
    }

    // Sort children by name
    const sortChildren = (nodes: HierarchyNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      for (const node of nodes) {
        if (node.children?.length) {
          sortChildren(node.children);
        }
      }
    };
    sortChildren(roots);

    return roots;
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const HierarchyTreeNode = ({
    node,
    level = 0,
  }: {
    node: HierarchyNode;
    level?: number;
  }) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isCurrentOrg = node.id === organization.id;

    return (
      <div>
        <div
          className={cn(
            'flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 transition-colors',
            isCurrentOrg && 'bg-primary/5 border border-primary/20'
          )}
          style={{ paddingLeft: `${level * 24 + 12}px` }}
        >
          {/* Expand/Collapse Button */}
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-6 w-6', !hasChildren && 'invisible')}
            onClick={() => toggleNode(node.id)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>

          {/* Icon */}
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              isCurrentOrg ? 'bg-primary/10' : 'bg-muted'
            )}
          >
            <Building2
              className={cn(
                'h-4 w-4',
                isCurrentOrg ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'font-medium truncate',
                  isCurrentOrg && 'text-primary'
                )}
              >
                {node.name}
              </span>
              {node.isRoot && (
                <Badge variant="outline" className="text-xs">
                  Root
                </Badge>
              )}
              {isCurrentOrg && (
                <Badge variant="default" className="text-xs">
                  Current
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {node.orgCode} • Level {node.depth}
            </div>
          </div>

          {/* Status */}
          <Badge
            variant={node.isActive ? 'default' : 'secondary'}
            className="text-xs"
          >
            {node.isActive ? 'Active' : 'Inactive'}
          </Badge>

          {/* Link to details */}
          {!isCurrentOrg && (
            <Link to="/organizations/$orgId" params={{ orgId: node.id }}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map((child) => (
              <HierarchyTreeNode key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Organization Hierarchy</CardTitle>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchHierarchy}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm mb-4">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : hierarchyData.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No hierarchy data available
          </div>
        ) : (
          <div className="space-y-1">
            {hierarchyData.map((node) => (
              <HierarchyTreeNode key={node.id} node={node} />
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-6 mt-6 pt-4 border-t text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-primary/10 border border-primary/20" />
            <span>Current organization</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Root
            </Badge>
            <span>Root organization</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

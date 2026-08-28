import java.util.*;

class Solution {
    class Node {
        int v;
        int x;
        int y;
        Node l;
        Node r;
        Node(int v, int x, int y) {this.v=v; this.x=x;this.y=y;}
    }
    
    class NodeInfo {
        int x;
        int y;
        int v;
        NodeInfo(int v, int x, int y) {
            this.v=v;
            this.x=x;
            this.y=y;
        }
    }
    
    int preorderc;
    int postorderc;
    
    public int[][] solution(int[][] nodeinfo) {
        preorderc = 0;
        postorderc = 0;
        PriorityQueue<NodeInfo> pq = new PriorityQueue<>(
            (NodeInfo a, NodeInfo b) -> {
                if (a.y == b.y)
                    return a.x-b.x;
                return b.y-a.y;
        });
        
        for (int i = 0 ; i < nodeinfo.length; i++) {
            pq.add(new NodeInfo(i+1, nodeinfo[i][0], nodeinfo[i][1]));
        }
        
        HashSet<Integer> nc = new HashSet<>();
        Node h;
        while (!pq.isEmpty()) {
            NodeInfo ni = pq.poll();
            nc.add(ni.v);
            if (h == null) {
                h = new Node(ni.v, ni.x, ni.y);
                continue;
            }
            
            Node cur = h;
            while (cur) {
                before = cur;
                if (ni.x < cur.x) {
                    cur = cur.l;
                } else {
                    cur = cur.r;
                }
            }
            
            if (ni.x < before.x)
                before.l = ni;
            else
                before.r = ni;
        }
        answer = new int[2][nc.size()];
        traversePreorder(answer[0], h);
        traversePostorder(answer[1], h);
        return answer;
    }
    
    void traversePreorder(int[] answer, Node h) {
        answer[preorderc++] = h.v;
        traversePreorder(answer, h.l)
            
    }
    
    void traversePostorder(int[] answer, Node h) {}
}
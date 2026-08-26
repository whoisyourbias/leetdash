import java.util.*;

class Solution {
    class Node {
        int sheep;
        int l;
        int r;
        Node(int sheep) {
			this.l = -1;
			this.r = -1;
            this.sheep = sheep;
        }
        Node(int l, int r, int sheep) {
            this.l = l;
            this.r = r;
            this.sheep  = sheep;
        }
        @Override
        public String toString() {
            return curSheep + "";
        }
    }
    
    class Status {
        int curSheep;
        ArrayDeque<Integer> reachable;
        Status() {
            this.curSheep = 0;
            this.reachable = new ArrayDeque<>();
        }
        
        void addNode(Node n) {
            this.curSheep += n.sheep;
			if (n.l != -1)
            	this.reachable.add(n.l);
			if (n.r != -1)
            	this.reachable.add(n.r);
        }
        @Override
        public String toString() {
            return curSheep + "";
        }
    }
    
    int max;
    
    public int solution(int[] info, int[][] edges) {
        max = Integer.MIN_VALUE;
        Node[] nodes = new Node[info.length];
        for (int i = 0 ; i < info.length; i++) {
            nodes[i] = new Node(info[i] == 0 ? 1 : -1);
        }
        
        for (int[] e: edges) {
            int parent = e[0];
            int child = e[1];
            
            if (nodes[parent].l == -1)
                nodes[parent].l = child;
            else
                nodes[parent].r = child;
        }
        
        Status init = new Status();
        init.addNode(nodes[0]);
        
        LinkedList<Status> q = new LinkedList<>();
        
        while (!q.isEmpty()) {
            Status p = q.pollFirst();
            
            max = Math.max(max, p.curSheep);
            
            for (Integer n : p.reachable) {
                // 조건확인.
                if (p.curSheep + nodes[n].sheep > 0) {
                    Status newS = new Status();
					newS.curSheep = p.curSheep + nodes[n].sheep;
					newS.reachable = p.reachable.clone();
					newS.reachable.remove(n);
					newS.addNode(nodes[n]);
					q.addFirst(newS);
                }
            }
        }
        return max;
    }
}

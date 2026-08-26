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
    }
    
    class Status {
        int sheeps;
        int wolfs;
        ArrayDeque<Integer> reachable;
        Status() {
            this.sheeps = 0;
            this.wolfs = 0;
            this.reachable = new ArrayDeque<>();
        }
        
        void addNode(Node n) {
            if (n.sheep == 0)
                this.sheeps++;
            else
                this.wolfs++;
			if (n.l != -1)
            	this.reachable.add(n.l);
			if (n.r != -1)
            	this.reachable.add(n.r);
        }
        
        @Override
        public String toString() {
            return "[sheeps" + +sheeps +"wolfs:" + wolfs +"]";
        }
    }
    
    int max;
    
    public int solution(int[] info, int[][] edges) {
        max = Integer.MIN_VALUE;
        Node[] nodes = new Node[info.length];
        for (int i = 0 ; i < info.length; i++) {
            nodes[i] = new Node(info[i]);
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
        q.add(init);
        while (!q.isEmpty()) {
            Status p = q.pollFirst();
            max = Math.max(max, p.sheeps);
            
            for (Integer n : p.reachable) {
                // 조건확인.
                if (p.sheeps - p.wolfs + (nodes[n].sheep == 0 ? 1 : -1 ) > 0) {
                    Status newS = new Status();
					newS.sheeps = p.sheeps;
                    newS.wolfs = p.wolfs;
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

import java.util.*;

class Solution {
    class Location {
        int locId;
        HashSet<Integer> linked;
        Location(int locId) {
            this.locId = locId;
            this.linked= new HashSet<>();
        }
    }
    
    class Kruskal {
        int locId;
        int moved;
        Kruskal(int locId,int moved) {this.locId = locId; this.moved=moved;}
    }
    
    Location[] l;
    int[] parent;
    public int[] solution(int n, int[][] roads, int[] sources, int destination) {
        
        l = new Location[n+1];
        for (int i = 1; i <= n ; i++) {
            l[i] = new Location(i);
        }
        
        for (int i = 0; i < roads.length;i++){
            int a= roads[i][0];
            int b = roads[i][1];
            
            l[a].linked.add(b);
            l[b].linked.add(a);
        }
        
        // union find
        
        int[] answer = new int[sources.length];
        
        for (int i = 0; i < sources.length; i++) {
            PriorityQueue<Kruskal> pq = new PriorityQueue<>(
                (a,b) -> a.moved - b.moved 
            );
            pq.add(new Kruskal(sources[i], 0));
            
            if (l[sources[i]].linked.size() == 0) {
                answer[i] = -1;
                continue;
            }
            
            parent = new int[n+1];
            for (int v = 0; v <= n; v++)
                parent[v] = v;
            Kruskal aswK = null;
            while (!pq.isEmpty()) {
                Kruskal k = pq.poll();
                
                if (k.locId == destination) {
                    aswK = k;
                    break;
                }
                
                for (int link: l[k.locId].linked) {
                    if (link == destination) {
                        aswK = new Kruskal(link, k.moved+1);
                        pq.clear();
                        break;
                    }
                    if (!union(k.locId, link))
                        continue;
                    pq.add(new Kruskal(link ,k.moved+1));
                }
            }
            
            if (aswK != null)
                answer[i] = aswK.moved;
            else
                answer[i] = -1;
        }
        
        return answer;
    }
    
    private int getParent(int x){
        if (x == parent[x])
            return x;
        
        return parent[x] = getParent(parent[x]);
    }
    
    private boolean union(int a, int b){
        int pa = getParent(a);
        int pb = getParent(b);
        
        if (pa == pb)
            // cycle
            return false;
        
        parent[pa] = Math.min(pa, pb);
        parent[pb] = Math.min(pa, pb);
        return true;
    }
}
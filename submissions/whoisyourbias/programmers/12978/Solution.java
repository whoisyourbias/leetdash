import java.util.*;

class Solution {
    
    class Vil {
        ArrayList<Integer> links;
        Vil() {
            this.links=new ArrayList<>();
        }
        
        public void add(int v) {
            this.links.add(v);
        }
    }
    
    class Dijkstra {
        int v;
        int cost;
        Dijkstra(int v, int cost) {
            this.v=v;
            this.cost=cost;
        }
        @Override
        public String toString() {
            return v + " " + cost;
        }
    } 
    
    public int solution(int N, int[][] roads, int K) {
        Vil[] graph = new Vil[N + 1];
        for (int i = 1; i <= N; i++) {
            graph[i] = new Vil();
        }
        
        int[][] cost = new int[N+1][N+1];
        
        for (int[] r : roads) {
            int a = r[0];
            int b = r[1];
            int c = r[2];
            
            graph[a].add(b);
            graph[b].add(a);
            
            if (cost[a][b] != 0) {
                cost[a][b] = Math.min(cost[a][b], c);
                cost[b][a] = Math.min(cost[a][b], c);   
            } else {
                cost[a][b] = c;
                cost[b][a] = c;
            }
        }
        
        
        int[] dist = new int[N+1];
        Arrays.fill(dist, Integer.MAX_VALUE);
        PriorityQueue<Dijkstra> pq = new PriorityQueue<>(
        (a,b) -> {
            return a.cost - b.cost;
        }
        );
        
        //init
        pq.add(new Dijkstra(1, 0));

        HashSet<Integer> answers = new HashSet<>();
        while (!pq.isEmpty()) {
            Dijkstra d = pq.poll();
            
            if (d.cost > dist[d.v])
                continue;
            
            dist[d.v] = Math.min(d.cost, dist[d.v]);
            if (dist[d.v] <= K)
                answers.add(d.v);
            for (Integer link : graph[d.v].links) {
                // 현재 코스트 + 다음경로까지 비용이 다익스트라경로보다 작으면 pq add
                if (d.cost + cost[d.v][link] < dist[link]) {
                    pq.add(new Dijkstra(link, d.cost + cost[d.v][link]));
                }
            }
        }

        
        return answers.size();
    }
}
import java.util.*;

class Solution {
    static final int[] ROWS = {0,0,1,-1};
    static final int[] COLS = {1,-1,0,0};
    
    // board: 25 * 25 -> 5125
    // 메모리공간 위협을 막기위해
    // bfs + dfs 혼합사용
    class BFSStatus {
        boolean[][] visited;
        int used;
        long cost;
        int r;
        int c;
        int last_dir;
        int cur_dir;
        BFSStatus(int r, int c) {this.used = 1; this.r=r;this.c=c;this.cost=100;this.visited=new boolean[N][N];this.last_dir=-1;this.cur_dir=-1;}
        BFSStatus(BFSStatus b) {
            this.r = b.r;
            this.c = b.c;
            this.cost = b.cost;
            this.used = b.used;
            this.visited = b.visited.clone();
            for (int i = 0; i < N ;i++)
                this.visited[i] = b.visited[i].clone();
            this.last_dir = b.last_dir;
            this.cur_dir = b.cur_dir;
        }
        public void calculateCostByLastDir() {
            if (last_dir == -1 || cur_dir == -1)
                return;
            this.cost += (last_dir == cur_dir ? 100 : 600);
        }
        @Override
        public String toString() {
            return "[" + "r:" + r + "c:" + c +"]";
        }
    }
    static int N;
    static ArrayDeque<BFSStatus> q;
    static long[][] dp;
    public int solution(int[][] board) {
        N=board.length;
        q = new ArrayDeque<>();
        dp = new long[N][N];
        for (int i = 0;i<N;i++)
            for(int j =0;j<N;j++)
                dp[i][j] = Long.MAX_VALUE;
        BFSStatus init = new BFSStatus(0,0);
        q.add(init);
        while (!q.isEmpty()) {
            BFSStatus b = q.poll();
            
            b.calculateCostByLastDir();
            if ((dp[b.r][b.c] != Long.MAX_VALUE) &&  
                (dp[b.r][b.c] < b.cost))
                continue;
            dp[b.r][b.c] = b.cost;
            
            if (b.visited[b.r][b.c])
                continue;
            b.visited[b.r][b.c]=true;
            
            if (b.r == N-1 && b.c == N-1) {
                continue;
            }
            
            
            for (int i = 0; i < 4; i++) {
                int nextr = b.r + ROWS[i];
                int nextc = b.c + COLS[i];
                if (nextr < 0 || nextc < 0 || nextr >= N || nextc >= N)
                    continue;
                if (board[nextr][nextc] == 1)
                    continue;
                if (b.visited[nextr][nextc])
                    continue;
                
                // update cur_dir;
                BFSStatus nb = new BFSStatus(b);
                nb.r = nextr;
                nb.c = nextc;
                nb.last_dir = nb.cur_dir;
                nb.cur_dir = i;
                q.addFirst(nb);
            }
        }
        
        return (int)dp[N-1][N-1];
    }
}
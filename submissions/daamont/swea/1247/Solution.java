import java.util.Scanner;

class Solution {
    static int N;
    static int companyX;
    static int companyY;
    static int homeX;
    static int homeY;
    static int[] customerX, customerY;
    static boolean[] visited;
    static int min;

    public static void main(String args[]) throws Exception {
        Scanner sc = new Scanner(System.in);
        int T;
        T = sc.nextInt();

        for (int test_case = 1; test_case <= T; test_case++) {
            N = sc.nextInt();

            companyX = sc.nextInt();
            companyY = sc.nextInt();
            homeX = sc.nextInt();
            homeY = sc.nextInt();
            customerX = new int[N];
            customerY = new int[N];
            for (int i = 0; i < N; i++) {
                customerX[i] = sc.nextInt();
                customerY[i] = sc.nextInt();
            }

            visited = new boolean[N];
            min = Integer.MAX_VALUE;

            dfs(0, 0, companyX, companyY);
            System.out.println("#" + test_case + " " + min);
        }
        sc.close();
    }

    static void dfs(int cnt, int distSum, int currentX, int currentY) {
        if (distSum >= min) {
            return;
        }

        if (cnt == N) {
            int total = distSum + getDistance(currentX, currentY, homeX, homeY);
            min = Math.min(min, total);
            return;
        }

        for (int i = 0; i < N; i++) {
            if (!visited[i]) {
                visited[i] = true;

                int next = getDistance(currentX, currentY, customerX[i], customerY[i]);
                dfs(cnt + 1, distSum + next, customerX[i], customerY[i]);

                visited[i] = false;
            }
        }
    }

    static int getDistance(int x1, int y1, int x2, int y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }
}
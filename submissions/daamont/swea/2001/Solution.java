import java.util.Scanner;
import java.io.FileInputStream;

class Solution {
    public static void main(String args[]) throws Exception {

        Scanner sc = new Scanner(System.in);
        int T;
        T = sc.nextInt();

        for (int test_case = 1; test_case <= T; test_case++) {
            int N = sc.nextInt();
            int M = sc.nextInt();

            int[][] arr = new int[N][N];
            for (int i = 0; i < N; i++) {
                for (int j = 0; j < N; j++) {
                    arr[i][j] = sc.nextInt();
                }
            }

            int max = 0;
            for (int r = 0; r <= N - M; r++) {
                for (int c = 0; c <= N - M; c++) {

                    int sum = 0;
                    for (int i = r; i < r + M; i++) {
                        for (int j = c; j < c + M; j++) {
                            sum += arr[i][j];
                        }
                    }

                    if (sum > max) {
                        max = sum;
                    }
                }
            }

            System.out.println("#" + test_case + " " + max);
        }
    }
}
import java.util.*;

public class Solution {

    public static void main(String[] args) {

        Scanner sc = new Scanner(System.in);

        for (int test_case = 1; test_case <= 10; test_case++) {

            int T = sc.nextInt();

            char[][] arr = new char[100][100];

            for (int i = 0; i < 100; i++) {
                String s = sc.next();

                for (int j = 0; j < 100; j++) {
                    arr[i][j] = s.charAt(j);
                }
            }

            int ans = 1;

            // 가로
            for (int r = 0; r < 100; r++) {
                for (int c = 0; c < 100; c++) {

                    // 짝수
                    int left = c;
                    int right = c + 1;

                    while (left >= 0 && right < 100) {
                        if (arr[r][left] != arr[r][right]) {
                            break;
                        }

                        left--;
                        right++;
                    }

                    int len = right - left - 1;
                    ans = Math.max(ans, len);

                    // 홀수
                    left = c - 1;
                    right = c + 1;

                    while (left >= 0 && right < 100) {
                        if (arr[r][left] != arr[r][right]) {
                            break;
                        }

                        left--;
                        right++;
                    }

                    len = right - left - 1;
                    ans = Math.max(ans, len);
                }
            }

            // 세로
            for (int c = 0; c < 100; c++) {
                for (int r = 0; r < 100; r++) {

                    // 짝수
                    int left = r;
                    int right = r + 1;

                    while (left >= 0 && right < 100) {
                        if (arr[left][c] != arr[right][c]) {
                            break;
                        }

                        left--;
                        right++;
                    }

                    int len = right - left - 1;
                    ans = Math.max(ans, len);

                    // 홀수
                    left = r - 1;
                    right = r + 1;

                    while (left >= 0 && right < 100) {
                        if (arr[left][c] != arr[right][c]) {
                            break;
                        }

                        left--;
                        right++;
                    }

                    len = right - left - 1;
                    ans = Math.max(ans, len);
                }
            }

            System.out.println("#" + T + " " + ans);
        }
    }
}
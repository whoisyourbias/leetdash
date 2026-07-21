import java.util.*;

class Solution {
    public void rotate(int[][] matrix) {
        int n = matrix.length;

        int i = n;
        while (i > 0) {
            int from = (n - i) / 2;
            int to = n - (n - i) / 2 - 1;
            int[] tmp = new int[n];
            int[] tmp2 = new int[n];

            System.out.printf("%d ~ %d\n", from, to);
            for (int v = 0; v < 4; v++) {
                System.out.printf("%d \n", v);
                System.out.println(Arrays.toString(tmp));
                System.out.println(Arrays.toString(tmp2));

            for (int k = 0; k < matrix.length; k++) {
                System.out.println(Arrays.toString(matrix[k]));
            }
                switch (v) {
                    case 0:
                        // copy tmp
                        for (int k = from; k <= to; k++) {
                            tmp[k] = matrix[k][to];
                        }
                        for (int k = to; k >= from; k--) {
                            matrix[k][to] = matrix[from][k];
                        }
                        break;
                    case 1:
                        for (int k = to - 1; k >= from; k--) {
                            tmp2[k] = matrix[to][k];
                        }

                        for (int k = from; k < to; k++) {
                            matrix[to][k] = tmp[n - 1 - k];
                        }

                        break;
                    case 2:
                        for (int k = to - 1; k >= from; k--) {
                            tmp[k] = matrix[k][from];
                        }

                        for (int k = to - 1; k >= from; k--) {
                            matrix[k][from] = tmp2[k];
                        }
                        break;
                    default:
                        for (int k = from + 1; k <= to; k++) {
                            matrix[from][k] = tmp[n - 1 - k];
                        }
                }
            }
            
            for (int k = 0; k < matrix.length; k++) {
                System.out.println(Arrays.toString(matrix[k]));
            }


            i = i - 2;
        }
    }
}

import java.util.Arrays;

class Solution {
    public int solution(int[][] triangle) {
	for (int i = 0; i < triangle.length; i++) {
			if (i ==0) continue;
			for (int j = 0; j < triangle[i].length; j++) {
				if (j == 0) {
					if (i > 0) 
						triangle[i][j] += triangle[i - 1][j];
				}
				else if (j == triangle[i].length - 1) {
					if (i > 0)
						triangle[i][j] += triangle[i - 1][j - 1];
				}
				else {
					triangle[i][j] += Math.max(triangle[i-1][j-1], triangle[i-1][j]);
				}
			}
		}

		return Arrays.stream(triangle[triangle.length - 1]).summaryStatistics().getMax();
    }
}

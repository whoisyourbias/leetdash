class Solution {
	public void merge(int[] nums1, int m, int[] nums2, int n) {
		int mi = m - 1;
		int ni = n - 1;
		int curi = m + n - 1;

		while (ni >= 0 && curi >= 0) {

			if (mi < 0) {
				while (ni >= 0) {
					nums1[curi--] = nums2[ni--];
				}
				break;
			}

			if (nums1[mi] <= nums2[ni]) {
				nums1[curi--] = nums2[ni--];
			} else {
				nums1[curi--] = nums1[mi--];

			}
		}
	}
}
